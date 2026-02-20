const fs = require('fs');
const path = require('path');
const { resolveSessionDir, logger } = require('./utils');

const DAYS_AGO = 30;
const TIME_LIMIT = Date.now() - (DAYS_AGO * 24 * 60 * 60 * 1000);

function* sessionFileGenerator(dir) {
  if (!dir || !fs.existsSync(dir)) return;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      yield* sessionFileGenerator(res);
    } else if (entry.isFile() && entry.name.startsWith('session-') && entry.name.endsWith('.json')) {
      yield res;
    }
  }
}

const stats = {
  totalSessionsScanned: 0,
  sessionsAnalyzed: 0,
  totalMessages: 0,
  userMessages: 0,
  geminiMessages: 0,
  linesAdded: 0,
  linesRemoved: 0,
  filesOverwritten: 0,
  uniqueFilesTouched: new Set(),
  tokens: { input: 0, output: 0, thoughts: 0, total: 0 },
  tools: {},
  toolErrors: {},
  languages: {},
  git: { commits: 0, pushes: 0, total: 0 },
  totalDurationMs: 0,
  activeDays: new Set(),
  hourlyActivity: Array(24).fill(0),
  userResponseTimes: [],
  sessionList: [],
  userMessageTimestamps: []
};

const sessionDir = resolveSessionDir();
if (!sessionDir) {
  logger.error("Could not resolve session directory.");
  process.exit(1);
}

for (const file of sessionFileGenerator(sessionDir)) {
  stats.totalSessionsScanned++;
  
  try {
    const content = fs.readFileSync(file, 'utf8');
    const conversation = JSON.parse(content);

    if (!conversation.startTime || !conversation.lastUpdated) {
      logger.info(`Skipping ${file}: missing startTime or lastUpdated`);
      continue;
    }

    const startTime = new Date(conversation.startTime).getTime();
    if (isNaN(startTime) || startTime < TIME_LIMIT) continue;

    stats.sessionsAnalyzed++;
    const date = conversation.startTime.split('T')[0];
    stats.activeDays.add(date);

    const lastUpdated = new Date(conversation.lastUpdated).getTime();
    if (isNaN(lastUpdated)) continue;

    const durationMs = lastUpdated - startTime;
    stats.totalDurationMs += durationMs;

    let errorCount = 0;
    let toolCount = 0;
    let userMsgCount = 0;
    let lastGeminiTime = null;

    if (!Array.isArray(conversation.messages)) {
      logger.info(`Skipping ${file}: messages is not an array`);
      continue;
    }

    for (const msg of conversation.messages) {
      stats.totalMessages++;
      if (!msg.timestamp) continue;
      const msgTime = new Date(msg.timestamp).getTime();
      if (isNaN(msgTime)) continue;
      
      const msgHour = new Date(msgTime).getHours();
      stats.hourlyActivity[msgHour]++;

      if (msg.type === 'user') {
        userMsgCount++;
        stats.userMessages++;
        stats.userMessageTimestamps.push({ ts: msgTime, sessionId: conversation.sessionId || file });
        
        if (lastGeminiTime) {
          const responseTime = (msgTime - lastGeminiTime) / 1000;
          if (responseTime > 0 && responseTime < 3600) {
            stats.userResponseTimes.push(responseTime);
          }
        }
      } else if (msg.type === 'gemini') {
        stats.geminiMessages++;
        lastGeminiTime = msgTime;
        if (msg.tokens) {
          stats.tokens.input += msg.tokens.input || 0;
          stats.tokens.output += msg.tokens.output || 0;
          stats.tokens.thoughts += msg.tokens.thoughts || 0;
          stats.tokens.total += msg.tokens.total || 0;
        }

        if (msg.toolCalls) {
          for (const call of msg.toolCalls) {
            toolCount++;
            stats.tools[call.name] = (stats.tools[call.name] || 0) + 1;
            
            if (call.status === 'error') {
              errorCount++;
              const errorText = (call.resultDisplay || '').toLowerCase();
              let cat = 'Other';
              if (errorText.includes('string to replace')) cat = 'Edit Failed';
              else if (errorText.includes('not found')) cat = 'File Not Found';
              else if (errorText.includes('timeout')) cat = 'Timeout';
              else if (errorText.includes('rejected')) cat = 'User Rejected';
              stats.toolErrors[cat] = (stats.toolErrors[cat] || 0) + 1;
            }

            const filePath = call && call.args && (call.args.file_path || call.args.path);
            if (filePath) {
              stats.uniqueFilesTouched.add(filePath);
              const ext = path.extname(filePath);
              if (ext) stats.languages[ext] = (stats.languages[ext] || 0) + 1;
              
              if (call.name === 'write_file') {
                stats.filesOverwritten++;
              } else if (call.name === 'replace' || call.name === 'edit') {
                const added = (call.args.new_string || '').split('\n').length;
                const removed = (call.args.old_string || '').split('\n').length;
                stats.linesAdded += added;
                stats.linesRemoved += removed;
              }
            }

            if (call.name === 'run_shell_command' && call.args && call.args.command?.trim().startsWith('git ')) {
              const cmd = call.args.command.trim();
              if (cmd.includes(' commit')) stats.git.commits++;
              if (cmd.includes(' push')) stats.git.pushes++;
            }
          }
        }
      }
    }

    // Keep only what we need for ranking
    stats.sessionList.push({
      id: conversation.sessionId || path.basename(file, '.json'),
      path: file,
      startTime,
      date,
      durationMinutes: Math.round(durationMs / 60000),
      userMessages: userMsgCount,
      toolCount,
      errorCount,
      score: (userMsgCount * 2) + toolCount + (errorCount * 5)
    });

  } catch (e) {
    logger.error(`Failed to process ${file}`, e);
  }
}

// O(N log N) Multi-session activity detection
function detectMultiClauding(timestamps) {
  if (timestamps.length === 0) return { overlap_events: 0, sessions_involved: 0, user_messages_during: 0 };
  
  timestamps.sort((a, b) => a.ts - b.ts);
  
  let overlapEvents = 0;
  const involved = new Set();
  let messagesDuring = 0;
  const WINDOW_MS = 30 * 60 * 1000;

  for (let i = 0; i < timestamps.length; i++) {
    const current = timestamps[i];
    let hasOverlap = false;
    
    // Look backward
    for (let j = i - 1; j >= 0 && (current.ts - timestamps[j].ts) < WINDOW_MS; j--) {
      if (timestamps[j].sessionId !== current.sessionId) {
        hasOverlap = true;
        involved.add(timestamps[j].sessionId);
        break;
      }
    }
    
    // Look forward
    if (!hasOverlap) {
      for (let j = i + 1; j < timestamps.length && (timestamps[j].ts - current.ts) < WINDOW_MS; j++) {
        if (timestamps[j].sessionId !== current.sessionId) {
          hasOverlap = true;
          involved.add(timestamps[j].sessionId);
          break;
        }
      }
    }

    if (hasOverlap) {
      messagesDuring++;
      involved.add(current.sessionId);
    }
  }

  return {
    overlap_events: involved.size > 0 ? Math.round(messagesDuring / 5) : 0, // Heuristic for "events"
    sessions_involved: involved.size,
    user_messages_during: messagesDuring
  };
}

const multi = detectMultiClauding(stats.userMessageTimestamps);

const finalStats = {
  ...stats,
  filesTouchedCount: stats.uniqueFilesTouched.size,
  activeDays: stats.activeDays.size,
  totalDurationHours: (stats.totalDurationMs / 3600000).toFixed(1),
  dateRange: {
    start: stats.sessionList.length ? new Date(Math.min(...stats.sessionList.map(s => s.startTime))).toISOString().split('T')[0] : '',
    end: stats.sessionList.length ? new Date(Math.max(...stats.sessionList.map(s => s.startTime))).toISOString().split('T')[0] : ''
  },
  msgsPerDay: stats.activeDays.size > 0 ? (stats.totalMessages / stats.activeDays.size).toFixed(1) : 0,
  multi_clauding: multi,
  median_response_time: stats.userResponseTimes.length > 0 ? stats.userResponseTimes.sort((a,b) => a-b)[Math.floor(stats.userResponseTimes.length / 2)] : 0,
  avg_response_time: stats.userResponseTimes.length > 0 ? stats.userResponseTimes.reduce((a,b) => a+b, 0) / stats.userResponseTimes.length : 0,
  uniqueFilesTouched: Array.from(stats.uniqueFilesTouched)
};

process.stdout.write(JSON.stringify(finalStats, null, 2));

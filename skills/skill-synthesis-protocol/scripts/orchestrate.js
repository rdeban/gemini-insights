const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { logger, getTempDir } = require('./utils');

const EXT_PATH = process.argv[2] || process.cwd();
const SCRIPTS_DIR = path.join(EXT_PATH, 'skills', 'skill-synthesis-protocol', 'scripts');
const TEMP_DIR = getTempDir();
const CACHE_BASE = path.join(EXT_PATH, '.insights-cache');
const FACETS_DIR = path.join(CACHE_BASE, 'facets');
const STATE_FILE = path.join(CACHE_BASE, 'state.json');

if (!fs.existsSync(FACETS_DIR)) fs.mkdirSync(FACETS_DIR, { recursive: true });

function runCommand(cmd, args, env = {}) {
  const result = spawnSync('node', [path.join(SCRIPTS_DIR, cmd), ...args], {
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    throw new Error(`Command ${cmd} failed: ${result.stderr}`);
  }
  return result.stdout;
}

function run() {
  let state = { startTime: Date.now() };
  if (fs.existsSync(STATE_FILE)) {
    try { state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (e) {}
  } else {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  }

  const statsPath = path.join(TEMP_DIR, 'stats.json');
  const todoPath = path.join(TEMP_DIR, 'TODO.json');
  const allFacetsPath = path.join(TEMP_DIR, 'all-facets.json');
  const synthesisPath = path.join(TEMP_DIR, 'synthesis.json');

  // PASS 1: Aggregation
  const statsJson = runCommand('aggregate-stats.js', []);
  fs.writeFileSync(statsPath, statsJson);
  const stats = JSON.parse(statsJson);

  // PASS 2: Missing Facets
  const topSessions = stats.sessionList
    .filter(s => s.userMessages > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  const missing = topSessions.filter(s => !fs.existsSync(path.join(FACETS_DIR, `${s.id}.json`)));

  if (missing.length > 0) {
    const todo = {
      task: "EXTRACT_FACETS",
      sessions: missing.map(s => {
        const transcript = runCommand('prepare-sampling.js', [], { 
          SELECTED_SESSION_IDS: s.id,
          INPUT_STATS: statsJson 
        });
        return { id: s.id, transcript };
      }),
      instructions: `Batch these! For each session, delegate to 'agent-session-analyst'. Save each result using 'node ${path.join(SCRIPTS_DIR, 'save-facet.js')} <id> <json>'.`
    };
    fs.writeFileSync(todoPath, JSON.stringify(todo, null, 2));
    console.log(`TODO: Please read '${todoPath}' and process the missing session facets.`);
    return;
  }

  // PASS 3: Qualitative Aggregation & Synthesis check
  const facets = topSessions
    .filter(s => fs.existsSync(path.join(FACETS_DIR, `${s.id}.json`)))
    .map(s => {
      try {
        return JSON.parse(fs.readFileSync(path.join(FACETS_DIR, `${s.id}.json`), 'utf8'));
      } catch (e) {
        return null;
      }
    })
    .filter(f => f !== null);

  // Initialize qualitative stats
  stats.qualitative = {
    outcomes: {},
    satisfaction: {},
    sessionTypes: {},
    frictionTypes: {},
    successTypes: {}
  };
  
  if (facets.length > 0) {
    fs.writeFileSync(allFacetsPath, JSON.stringify(facets, null, 2));

    facets.forEach(f => {
      if (f.outcome) stats.qualitative.outcomes[f.outcome] = (stats.qualitative.outcomes[f.outcome] || 0) + 1;
      if (f.claude_helpfulness) stats.qualitative.satisfaction[f.claude_helpfulness] = (stats.qualitative.satisfaction[f.claude_helpfulness] || 0) + 1;
      if (f.session_type) stats.qualitative.sessionTypes[f.session_type] = (stats.qualitative.sessionTypes[f.session_type] || 0) + 1;
      if (f.primary_success) stats.qualitative.successTypes[f.primary_success] = (stats.qualitative.successTypes[f.primary_success] || 0) + 1;
      if (f.friction_counts) {
        Object.entries(f.friction_counts).forEach(([type, count]) => {
          stats.qualitative.frictionTypes[type] = (stats.qualitative.frictionTypes[type] || 0) + count;
        });
      }
    });
  }

  if (!fs.existsSync(synthesisPath)) {
    const todo = {
      task: "GLOBAL_SYNTHESIS",
      statsFile: statsPath,
      facetsFile: allFacetsPath,
      synthesisPath: synthesisPath,
      instructions: `Activate 'skill-synthesis-protocol'. Read '${statsPath}' and '${allFacetsPath}'. Save the resulting synthesis object directly to '${synthesisPath}'.`
    };
    fs.writeFileSync(todoPath, JSON.stringify(todo, null, 2));
    fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
    console.log(`TODO: Please read '${todoPath}' and perform the global synthesis.`);
    return;
  }

  // PASS 4: Final Visualization
  console.log("## PASS 4: Generating Report");
  
  stats.meta = {
    generationTimeMs: Date.now() - (state.startTime || Date.now()),
    qualitativeSessionsAnalyzed: topSessions.length,
    totalSessionsScanned: stats.totalSessionsScanned,
    sessionsAnalyzedCount: stats.sessionsAnalyzed
  };
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));

  const reportPath = path.join(process.cwd(), 'gemini-insights.html');
  runCommand('generate-report.js', [statsPath, synthesisPath, reportPath]);
  
  console.log(`FINISH: Report generated successfully at ${reportPath}`);
  
  if (fs.existsSync(todoPath)) fs.unlinkSync(todoPath);
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
}

try { run(); } catch (e) { logger.error("Orchestration failed", e); }

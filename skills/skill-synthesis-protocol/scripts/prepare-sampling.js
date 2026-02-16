const fs = require('fs');
const path = require('path');

function run(input) {
  try {
    const stats = JSON.parse(input);
    const SELECTED_IDS = process.env.SELECTED_SESSION_IDS ? process.env.SELECTED_SESSION_IDS.split(',') : [];
    
    let selected;
    if (SELECTED_IDS.length > 0) {
      selected = stats.sessionList.filter(s => SELECTED_IDS.includes(s.id));
    } else {
      // Fallback: heuristic scoring
      selected = stats.sessionList.filter(s => s.userMessages > 1).sort((a, b) => b.score - a.score).slice(0, 15);
    }

    function cleanContent(msg) {
      const content = msg.content || msg.text || '';
      if (typeof content === 'string') return content.slice(0, 4000);
      if (Array.isArray(content)) {
        return content.map(p => {
          if (typeof p === 'string') return p;
          if (p.text) return p.text;
          if (p.type === 'text') return p.text;
          return `[${p.type || 'unknown'}]`;
        }).join('\n').slice(0, 4000);
      }
      if (msg.parts && Array.isArray(msg.parts)) {
        return msg.parts.map(p => {
          if (p.text) return p.text;
          if (p.functionCall) return `[CALL: ${p.functionCall.name}]`;
          if (p.functionResponse) return `[RESPONSE: ${p.functionResponse.name}]`;
          return '[PART]';
        }).join('\n').slice(0, 4000);
      }
      return '';
    }

    let output = "";
    for (const s of selected) {
      try {
        const data = JSON.parse(fs.readFileSync(s.path, 'utf8'));
        output += `===SESSION_BOUNDARY::${s.id}===\n`;
        output += `[METADATA] ID: ${s.id}, Date: ${s.date || 'unknown'}, Duration: ${s.durationMinutes}m, Tools: ${s.toolCount}, Errors: ${s.errorCount}\n\n`;
        
        const messages = data.messages || [];
        // Extract 4 first turns and 4 last turns + ALL tool errors
        const start = messages.slice(0, 8);
        const end = messages.slice(-6);
        const errors = messages.filter(m => m.toolCalls && m.toolCalls.some(tc => tc.status === 'error'));
        
        const combined = Array.from(new Set([...start, ...errors, ...end])).sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

        for (const msg of combined) {
          const role = msg.type === 'gemini' ? 'ASSISTANT' : (msg.type || 'USER').toUpperCase();
          const content = cleanContent(msg);
          if (content) output += `[${role}] ${content}\n\n`;
          
          if (msg.toolCalls) {
            for (const call of msg.toolCalls) {
              if (call.status === 'error') {
                output += `[TOOL_ERROR] ${call.name}: ${call.resultDisplay}\n\n`;
              }
            }
          }
        }
        output += "\n";
      } catch (e) {}
    }
    process.stdout.write(output);
  } catch (e) {
    process.stderr.write(`Error in prepare-sampling: ${e.message}\n`);
    process.exit(1);
  }
}

if (process.env.INPUT_STATS) {
  run(process.env.INPUT_STATS);
} else {
  let input = "";
  process.stdin.on('data', data => { input += data; });
  process.stdin.on('end', () => { run(input); });
}

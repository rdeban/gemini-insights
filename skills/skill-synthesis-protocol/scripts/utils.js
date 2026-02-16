const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

/**
 * Robust JSON extractor that finds balanced braces.
 */
function extractJson(str) {
  if (!str) return null;
  let depth = 0;
  let start = -1;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (str[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        const potential = str.slice(start, i + 1);
        try { return JSON.parse(potential); } catch (e) { continue; }
      }
    }
  }
  return null;
}

/**
 * Resolves the global Gemini session directory.
 */
function resolveSessionDir() {
  const envPath = process.env.GEMINI_SESSION_DIR;
  if (envPath && fs.existsSync(envPath)) return envPath;
  const homeGemini = path.join(os.homedir(), '.gemini', 'tmp');
  if (fs.existsSync(homeGemini)) return homeGemini;
  return null;
}

/**
 * Gets the authorized temporary directory for the current project.
 * Prioritizes GEMINI_TEMP_DIR which is the CLI-authorized workspace.
 */
function getTempDir() {
  // 1. Check for CLI-provided temp dir (Authorized Workspace)
  const geminiTemp = process.env.GEMINI_TEMP_DIR;
  if (geminiTemp && fs.existsSync(geminiTemp)) return geminiTemp;

  // 2. Check for extension-specific override
  if (process.env.INSIGHTS_TEMP_DIR) {
    const envTemp = process.env.INSIGHTS_TEMP_DIR;
    if (!fs.existsSync(envTemp)) fs.mkdirSync(envTemp, { recursive: true });
    return envTemp;
  }

  // 3. Fallback to standard CLI pattern: ~/.gemini/tmp/<project-hash>
  const projectRoot = process.cwd();
  const hash = crypto.createHash('sha256').update(projectRoot).digest('hex');
  const projectTempDir = path.join(os.homedir(), '.gemini', 'tmp', hash);

  if (!fs.existsSync(projectTempDir)) {
    fs.mkdirSync(projectTempDir, { recursive: true });
  }

  return projectTempDir;
}

/**
 * Proper HTML escaping.
 */
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const logger = {
  error: (msg, err) => console.error(`[ERROR] ${msg}`, err ? (err.stack || err) : ''),
  info: (msg) => console.warn(`[INFO] ${msg}`)
};

module.exports = { extractJson, resolveSessionDir, getTempDir, escapeHtml, logger };

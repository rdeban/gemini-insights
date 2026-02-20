const { extractJson, escapeHtml, getTempDir, resolveSessionDir, resolveCacheDir } = require('./utils');
const fs = require('fs');
const path = require('path');
const os = require('os');

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test('extractJson - simple', () => {
  const result = extractJson('{"a":1}');
  return JSON.stringify(result) === '{"a":1}';
});

test('extractJson - with prefix/suffix', () => {
  const result = extractJson('Random text {"b":2} more text');
  return JSON.stringify(result) === '{"b":2}';
});

test('extractJson - markdown', () => {
  const result = extractJson('```json\n{"c":3}\n```');
  return JSON.stringify(result) === '{"c":3}';
});

test('extractJson - nested', () => {
  const result = extractJson('{"d":{"e":4}}');
  return JSON.stringify(result) === '{"d":{"e":4}}';
});

test('extractJson - invalid', () => {
  const result = extractJson('{"f":5');
  return result === null;
});

test('escapeHtml', () => {
  const input = `<div class="test">"Hello" & 'World'</div>`;
  const expected = '&lt;div class=&quot;test&quot;&gt;&quot;Hello&quot; &amp; &#039;World&#039;&lt;/div&gt;';
  return escapeHtml(input) === expected;
});

test('getTempDir - environment variable', () => {
  const original = process.env.GEMINI_TEMP_DIR;
  const mockDir = path.join(os.tmpdir(), 'gemini-test-' + Date.now());
  fs.mkdirSync(mockDir, { recursive: true });
  process.env.GEMINI_TEMP_DIR = mockDir;
  try {
    const result = getTempDir();
    return result === mockDir;
  } finally {
    process.env.GEMINI_TEMP_DIR = original;
    fs.rmSync(mockDir, { recursive: true, force: true });
  }
});

test('getTempDir - respects GEMINI_CLI_HOME', () => {
  const originalHome = process.env.GEMINI_CLI_HOME;
  const originalTemp = process.env.GEMINI_TEMP_DIR;
  const originalInsights = process.env.INSIGHTS_TEMP_DIR;
  
  // Ensure other variables are unset to hit the GEMINI_CLI_HOME logic
  delete process.env.GEMINI_TEMP_DIR;
  delete process.env.INSIGHTS_TEMP_DIR;

  const mockHome = path.join(os.tmpdir(), 'gemini-home-test-' + Date.now());
  fs.mkdirSync(mockHome, { recursive: true });
  process.env.GEMINI_CLI_HOME = mockHome;
  
  try {
    const result = getTempDir();
    // It should be in <mockHome>/.gemini/tmp/insights-extension/<hash>
    return result.includes(path.join(mockHome, '.gemini', 'tmp', 'insights-extension'));
  } finally {
    process.env.GEMINI_CLI_HOME = originalHome;
    process.env.GEMINI_TEMP_DIR = originalTemp;
    process.env.INSIGHTS_TEMP_DIR = originalInsights;
    fs.rmSync(mockHome, { recursive: true, force: true });
  }
});

test('resolveCacheDir - respects GEMINI_CLI_HOME', () => {
  const originalHome = process.env.GEMINI_CLI_HOME;
  const originalCache = process.env.INSIGHTS_CACHE_DIR;
  
  delete process.env.INSIGHTS_CACHE_DIR;
  
  const mockHome = path.join(os.tmpdir(), 'gemini-cache-test-' + Date.now());
  fs.mkdirSync(mockHome, { recursive: true });
  process.env.GEMINI_CLI_HOME = mockHome;
  
  try {
    const result = resolveCacheDir();
    const expected = path.join(mockHome, '.gemini', 'cache', 'insights-extension');
    return result === expected && fs.existsSync(result);
  } finally {
    process.env.GEMINI_CLI_HOME = originalHome;
    process.env.INSIGHTS_CACHE_DIR = originalCache;
    fs.rmSync(mockHome, { recursive: true, force: true });
  }
});

test('resolveSessionDir - respects GEMINI_CLI_HOME', () => {
  const { resolveSessionDir } = require('./utils');
  const originalHome = process.env.GEMINI_CLI_HOME;
  const originalSessionDir = process.env.GEMINI_SESSION_DIR;
  
  delete process.env.GEMINI_SESSION_DIR;
  
  const mockHome = path.join(os.tmpdir(), 'gemini-home-session-test-' + Date.now());
  const mockTmp = path.join(mockHome, '.gemini', 'tmp');
  fs.mkdirSync(mockTmp, { recursive: true });
  process.env.GEMINI_CLI_HOME = mockHome;
  
  try {
    const result = resolveSessionDir();
    return result === mockTmp;
  } finally {
    process.env.GEMINI_CLI_HOME = originalHome;
    process.env.GEMINI_SESSION_DIR = originalSessionDir;
    fs.rmSync(mockHome, { recursive: true, force: true });
  }
});

async function runTests() {
  let passed = 0;
  for (const t of tests) {
    try {
      const result = await t.fn();
      if (result) {
        console.log(`✅ ${t.name}`);
        passed++;
      } else {
        console.error(`❌ ${t.name}`);
      }
    } catch (e) {
      console.error(`💥 ${t.name}: ${e.message}`);
    }
  }
  console.log(`
Passed: ${passed}/${tests.length}`);
  if (passed !== tests.length) process.exit(1);
}

runTests();

const { extractJson, escapeHtml, getTempDir } = require('./utils');
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

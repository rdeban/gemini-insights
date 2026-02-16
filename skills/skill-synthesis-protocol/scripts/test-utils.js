const { extractJson } = require('./utils');

const tests = [
  {
    name: "Clean JSON",
    input: '{"a": 1}',
    expected: { a: 1 }
  },
  {
    name: "Markdown wrapped",
    input: 'Here is the result:\n```json\n{"b": 2}\n```\nHope that helps.',
    expected: { b: 2 }
  },
  {
    name: "Dirty prefix/suffix",
    input: '... { "c": 3 } !!!',
    expected: { c: 3 }
  },
  {
    name: "Nested objects",
    input: '{"d": {"e": 4}}',
    expected: { d: { e: 4 } }
  },
  {
    name: "Multiple objects (finds first)",
    input: '{"f": 5} then {"g": 6}',
    expected: { f: 5 }
  }
];

let failed = 0;
for (const t of tests) {
  const actual = extractJson(t.input);
  const pass = JSON.stringify(actual) === JSON.stringify(t.expected);
  console.log(`${pass ? '✅' : '❌'} ${t.name}`);
  if (!pass) {
    console.log(`   Expected: ${JSON.stringify(t.expected)}`);
    console.log(`   Actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

if (failed > 0) {
  process.exit(1);
}

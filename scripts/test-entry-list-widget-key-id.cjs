const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync(
  'screens/EntryListScreen.js',
  'utf8'
);

const start = source.indexOf(
  'const renderDashboardWidget = (item, isShare = false) => {'
);

const end = source.indexOf(
  '\n  const [meta, setMeta]',
  start
);

assert.ok(start >= 0 && end > start);

const body = source.slice(start, end);

const validKeys = body.match(
  /key:\s*widgetKind\s*\+\s*'-'\s*\+\s*widgetId\b/g
) || [];

assert.equal(validKeys.length, 5);

assert.doesNotMatch(
  body,
  /key:\s*widgetKind\s*\+\s*'-'\s*\+\s*id\b/
);

console.log('EntryList health widget keys: PASS');

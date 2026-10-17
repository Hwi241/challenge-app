const assert = require('node:assert/strict');
const fs = require('node:fs');
const babel = require('@babel/core');

const filename = 'utils/togetherWeeklyDayV4.js';

const compiled = babel.transformSync(
  fs.readFileSync(filename, 'utf8'),
  {
    filename,
    presets: [
      ['babel-preset-expo', {
        jsxRuntime: 'automatic',
      }],
    ],
    babelrc: false,
    configFile: false,
  }
).code;

const mod = { exports: {} };

new Function(
  'require',
  'module',
  'exports',
  compiled
)(
  require,
  mod,
  mod.exports
);

const {
  getTogetherWeeklyDateRelationV4,
  getTogetherWeeklyDayPresentationV4,
} = mod.exports;

const todayKey = '2026-10-14';

const mark = (status, localDate) =>
  getTogetherWeeklyDayPresentationV4({
    status,
    localDate,
    todayKey,
  }).symbol;

assert.equal(
  getTogetherWeeklyDateRelationV4(
    '2026-10-13',
    todayKey
  ),
  'past'
);
assert.equal(
  getTogetherWeeklyDateRelationV4(
    '2026-10-14',
    todayKey
  ),
  'today'
);
assert.equal(
  getTogetherWeeklyDateRelationV4(
    '2026-10-15',
    todayKey
  ),
  'future'
);
assert.equal(mark('done', '2026-10-13'), '✓');
assert.equal(mark('pending', '2026-10-13'), '✕');
assert.equal(mark('pending', '2026-10-14'), '·');
assert.equal(mark('done', '2026-10-14'), '✓');
assert.equal(mark('off', '2026-10-13'), '–');
assert.equal(mark('pending', '2026-10-15'), '–');
assert.equal(mark('unknown', '2026-10-13'), '?');
assert.equal(mark('invalid', '2026-10-13'), '?');

const component = fs.readFileSync(
  'components/TogetherRoomWeeklyV3.js',
  'utf8'
);

assert.match(component, /getTogetherWeeklyDayPresentationV4/);
assert.match(component, /getTogetherWeeklyDateRelationV4/);
assert.match(component, /getTogetherRoomDateKeyV3/);
assert.match(component, /AppState\.addEventListener/);
assert.match(component, /todayKey=\{todayKey\}/);
assert.match(component, /#111111/);
assert.match(component, /#777777/);
assert.match(component, /#C4C4C4/);
assert.doesNotMatch(
  component,
  /color\.successBg|color\.successBorder|color\.success\b/
);

console.log('Together weekly day v4: PASS');

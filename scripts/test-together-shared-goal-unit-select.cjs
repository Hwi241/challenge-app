const assert = require('node:assert/strict');
const fs = require('node:fs');
const babel = require('@babel/core');

const filename = 'screens/TogetherSharedGoalCreateScreen.js';
const source = fs.readFileSync(filename, 'utf8');

assert.ok(
  babel.transformSync(source, {
    filename,
    presets: [['babel-preset-expo', { jsxRuntime: 'automatic' }]],
    babelrc: false,
    configFile: false,
  })
);

assert.match(source, /useState\('회'\)/);

const customIndex = source.indexOf("value: 'custom', label: '직접 입력'");
const countIndex = source.indexOf("value: '회', label: '횟수 (회)'");

assert.ok(customIndex >= 0);
assert.ok(countIndex > customIndex);

for (const value of [
  'km', 'm', '시간', '분', '초', '개', '페이지', 'kg', '원', '일',
]) {
  assert.ok(source.includes(`value: '${value}'`), `Missing unit: ${value}`);
}

assert.match(source, /unitChoice === 'custom'/);
assert.match(source, /value=\{customUnit\}/);
assert.match(source, /unit: selectedUnit/);
assert.match(source, /createTogetherRoomDraftV2/);
assert.match(source, /mode: 'shared_goal'/);
assert.match(source, /navigation\.replace\('TogetherInviteDraft'/);
assert.match(source, /setUnitMenuOpen/);
assert.match(source, /nestedScrollEnabled/);

console.log('Together shared goal unit dropdown: PASS');

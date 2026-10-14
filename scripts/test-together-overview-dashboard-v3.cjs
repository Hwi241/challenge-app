const assert = require('node:assert/strict');
const fs = require('node:fs');
const babel = require('@babel/core');

const filename =
  'components/TogetherRoomOverviewV3.js';

const source = fs.readFileSync(
  filename,
  'utf8'
);

assert.ok(
  babel.transformSync(source, {
    filename,
    presets: [
      ['babel-preset-expo', {
        jsxRuntime: 'automatic',
      }],
    ],
    babelrc: false,
    configFile: false,
  })
);

for (const mode of [
  'watch',
  'same_push',
  'paired_push',
  'shared_goal',
]) {
  assert.ok(
    source.includes(`mode === '${mode}'`),
    `Missing dashboard mode: ${mode}`
  );
}

for (const marker of [
  '공유자의 오늘 활동',
  '같은 PUSH · 오늘의 실천',
  '서로 다른 PUSH · 오늘의 실천',
  '공동 목표 달성률',
  '함께 지켜보는 사람',
  '완료 기록 없음',
  '미수신',
  'member.contribution',
  'TogetherMemberSyncMetaV2',
  'visibleMembers.map',
  'visibleCount',
]) {
  assert.ok(
    source.includes(marker),
    `Missing UI feature: ${marker}`
  );
}

assert.doesNotMatch(
  source,
  /rank|순위|등수|photoUri|imageUri|memoText|entryText/
);

const screen = fs.readFileSync(
  'screens/TogetherRoomDetailScreen.js',
  'utf8'
);

const overviewIndex = screen.indexOf(
  '<TogetherRoomOverviewV3'
);

const weeklyIndex = screen.indexOf(
  '<TogetherRoomWeeklyV3'
);

assert.ok(
  overviewIndex >= 0
  && weeklyIndex > overviewIndex,
  'Dashboard must appear before weekly records'
);

console.log(
  'Together four-mode dashboard: PASS'
);

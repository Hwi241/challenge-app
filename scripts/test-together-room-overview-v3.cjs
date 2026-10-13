const assert = require('node:assert/strict');
const fs = require('node:fs');
const babel = require('@babel/core');

const filename = 'utils/togetherRoomOverviewV3.js';

const transformed = babel.transformSync(
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

const moduleRef = { exports: {} };

new Function(
  'module',
  'exports',
  'require',
  transformed
)(moduleRef, moduleRef.exports, require);

const {
  buildTogetherRoomOverviewV3,
  getTogetherRoomDateKeyV3,
} = moduleRef.exports;

const now = Date.parse('2026-10-13T12:00:00Z');

assert.equal(
  getTogetherRoomDateKeyV3(now, 'Asia/Seoul'),
  '2026-10-13'
);

const members = [
  {
    userId: 'owner',
    role: 'owner',
    status: 'active',
    displayName: '방장',
    state: {
      localDate: '2026-10-13',
      completed: true,
      streak: 5,
      progress: 0.8,
      contribution: 12,
    },
  },
  {
    userId: 'member',
    role: 'member',
    status: 'active',
    displayName: '친구',
    state: {
      localDate: '2026-10-12',
      completed: true,
      streak: 3,
      contribution: 8,
    },
  },
];

const base = {
  ownerUserId: 'owner',
  timezone: 'Asia/Seoul',
};

const watch = buildTogetherRoomOverviewV3({
  room: { ...base, mode: 'watch' },
  members,
  now,
});

assert.equal(watch.completedCount, 1);
assert.equal(watch.trackedCount, 1);
assert.equal(watch.supporterCount, 1);

const same = buildTogetherRoomOverviewV3({
  room: { ...base, mode: 'same_push' },
  members,
  now,
});

assert.equal(same.completedCount, 1);
assert.equal(same.knownCount, 1);
assert.equal(same.unknownCount, 1);
assert.equal(same.members[0].progress, 0.8);

const paired = buildTogetherRoomOverviewV3({
  room: { ...base, mode: 'paired_push' },
  members,
  now,
});

assert.equal(paired.completedCount, 1);
assert.equal(paired.members[1].activity, 'unknown');

const shared = buildTogetherRoomOverviewV3({
  room: {
    ...base,
    mode: 'shared_goal',
    sharedGoal: {
      target: 100,
      unit: 'km',
    },
  },
  members,
  now,
});

assert.equal(shared.contributionTotal, 20);
assert.equal(shared.contributionKnownCount, 2);
assert.equal(shared.percentage, 20);
assert.equal(shared.unit, 'km');

const empty = buildTogetherRoomOverviewV3({
  room: { ...base, mode: 'shared_goal' },
  members: [],
  now,
});

assert.equal(empty.completedCount, 0);
assert.equal(empty.knownCount, 0);
assert.equal(empty.contributionKnownCount, 0);
assert.equal(empty.percentage, null);

const screen = fs.readFileSync(
  'screens/TogetherRoomDetailScreen.js',
  'utf8'
);

const component = fs.readFileSync(
  'components/TogetherRoomOverviewV3.js',
  'utf8'
);

assert.match(screen, /TogetherRoomOverviewV3/);
assert.match(component, /buildTogetherRoomOverviewV3/);
assert.match(component, /visibleCount/);
assert.match(component, /TogetherMemberSyncMetaV2/);

console.log('Together room overview v3: PASS');

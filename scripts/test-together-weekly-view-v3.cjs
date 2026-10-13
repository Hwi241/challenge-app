const assert = require('node:assert/strict');
const fs = require('node:fs');
const babel = require('@babel/core');

const filename =
  'utils/togetherWeeklyViewV3.js';

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

const moduleObject = {
  exports: {},
};

new Function(
  'require',
  'module',
  'exports',
  transformed
)(
  require,
  moduleObject,
  moduleObject.exports
);

const {
  buildTogetherWeeklyViewV3,
} = moduleObject.exports;

const room = {
  id: 'room1',
  mode: 'same_push',
  ownerUserId: 'owner',
};

const members = [
  {
    userId: 'owner',
    displayName: '공유자',
    role: 'owner',
    status: 'active',
  },
  {
    userId: 'friend',
    displayName: '함께하는 친구',
    role: 'member',
    status: 'active',
  },
  {
    userId: 'former',
    displayName: '탈퇴자',
    role: 'member',
    status: 'left',
  },
];

const week = {
  startDate: '2026-10-12',
  endDate: '2026-10-14',
  memberCount: 2,
  limitedTo: 8,
  members: [
    {
      userId: 'owner',
      days: [
        {
          localDate: '2026-10-12',
          status: 'done',
        },
        {
          localDate: '2026-10-13',
          status: 'pending',
        },
      ],
    },
    {
      userId: 'friend',
      days: [
        {
          localDate: '2026-10-12',
          status: 'off',
        },
        {
          localDate: '2026-10-14',
          status: 'done',
        },
      ],
    },
    {
      userId: 'former',
      days: [
        {
          localDate: '2026-10-14',
          status: 'done',
        },
      ],
    },
  ],
};

const same = buildTogetherWeeklyViewV3({
  room,
  members,
  week,
});

assert.deepEqual(same.dates, [
  '2026-10-12',
  '2026-10-13',
  '2026-10-14',
]);

assert.equal(same.rows.length, 2);

assert.deepEqual(
  same.rows[0].days.map((day) => day.status),
  ['done', 'pending', 'unknown']
);

assert.deepEqual(
  same.rows[1].days.map((day) => day.status),
  ['off', 'unknown', 'done']
);

assert.equal(
  same.rows[0].completedCount,
  1
);

assert.equal(
  same.rows[0].unknownCount,
  1
);

const watch = buildTogetherWeeklyViewV3({
  room: {
    ...room,
    mode: 'watch',
  },
  members,
  week,
});

assert.deepEqual(
  watch.rows.map((row) => row.userId),
  ['owner']
);

const paired = buildTogetherWeeklyViewV3({
  room: {
    ...room,
    mode: 'paired_push',
  },
  members,
  week,
});

assert.equal(paired.rows.length, 2);

const shared = buildTogetherWeeklyViewV3({
  room: {
    ...room,
    mode: 'shared_goal',
  },
  members,
  week,
});

assert.equal(shared.rows.length, 2);
assert.equal(
  shared.rows[1].days[1].status,
  'unknown'
);

const invalid = buildTogetherWeeklyViewV3({
  room,
  members,
  week: {
    ...week,
    startDate: '2026-10-15',
    endDate: '2026-10-14',
  },
});

assert.equal(invalid, null);

const tooLong = buildTogetherWeeklyViewV3({
  room,
  members,
  week: {
    ...week,
    startDate: '2026-10-01',
    endDate: '2026-10-14',
  },
});

assert.equal(tooLong, null);

const incompleteServerData =
  buildTogetherWeeklyViewV3({
    room,
    members,
    week: {
      ...week,
      members: [],
    },
  });

assert.equal(
  incompleteServerData.rows.length,
  0
);

const limited = buildTogetherWeeklyViewV3({
  room,
  members,
  week: {
    ...week,
    memberCount: 12,
  },
});

assert.equal(limited.limited, true);

const screen = fs.readFileSync(
  'screens/TogetherRoomDetailScreen.js',
  'utf8'
);

const component = fs.readFileSync(
  'components/TogetherRoomWeeklyV3.js',
  'utf8'
);

assert.match(
  screen,
  /TogetherRoomOverviewV3/
);

assert.match(
  screen,
  /TogetherRoomWeeklyV3/
);

assert.match(
  component,
  /loadTogetherWeekV3/
);

assert.match(
  component,
  /useIsFocused/
);

assert.match(
  component,
  /WIDE_WIDTH = 600/
);

assert.match(
  component,
  /numberOfLines=\{1\}/
);

assert.match(
  component,
  /미수신 또는 비공개/
);

assert.match(
  component,
  /status === 'done'/
);

assert.doesNotMatch(
  component,
  /photoUri|imageUri|memoText|entryText/
);

console.log(
  'Together weekly view v3: PASS'
);

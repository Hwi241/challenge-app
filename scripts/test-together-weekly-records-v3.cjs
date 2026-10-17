const assert = require('node:assert/strict');
const fs = require('node:fs');
const babel = require('@babel/core');

const overviewFile =
  'utils/togetherRoomOverviewV3.js';

const weeklyFile =
  'utils/togetherWeeklyRecordsV3.js';

const compile = (filename) =>
  babel.transformSync(
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

const overviewModule = { exports: {} };

new Function(
  'require',
  'module',
  'exports',
  compile(overviewFile)
)(
  require,
  overviewModule,
  overviewModule.exports
);

const weeklyModule = { exports: {} };

new Function(
  'require',
  'module',
  'exports',
  compile(weeklyFile)
)(
  (name) => {
    if (name === './togetherRoomOverviewV3') {
      return overviewModule.exports;
    }

    if (name === './challengeType') {
      return {
        CHALLENGE_TYPE: {
          HABIT: 'habit',
          ROTATION: 'rotation',
          CHALLENGE: 'challenge',
        },
        getChallengeType: (card) =>
          card?.type || 'challenge',
      };
    }

    if (name === './recordRoomEntries') {
      return {
        loadRecordRoomEntries: async () => [],
      };
    }

    if (
      name === '@react-native-async-storage/async-storage'
    ) {
      return {
        __esModule: true,
        default: {},
      };
    }

    return require(name);
  },
  weeklyModule,
  weeklyModule.exports
);

const {
  buildTogetherWeekDaysV3,
} = weeklyModule.exports;

const now =
  Date.parse('2026-10-13T12:00:00Z');

const joinedAt =
  '2026-10-10T10:00:00Z';

const habit = {
  id: 'h1',
  type: 'habit',
  habitCycle: {
    type: 'weekly',
    days: ['월', '화', '토'],
  },
};

const records = [
  {
    id: 'before-join',
    timestamp: '2026-10-10T08:00:00Z',
  },
  {
    id: 'after-join',
    timestamp: '2026-10-10T11:00:00Z',
  },
  {
    id: 'monday',
    timestamp: '2026-10-12T02:00:00Z',
  },
];

const days = buildTogetherWeekDaysV3({
  card: habit,
  entries: records,
  joinedAt,
  timezone: 'Asia/Seoul',
  now,
});

assert.deepEqual(days, [
  {
    localDate: '2026-10-10',
    status: 'done',
  },
  {
    localDate: '2026-10-11',
    status: 'off',
  },
  {
    localDate: '2026-10-12',
    status: 'done',
  },
  {
    localDate: '2026-10-13',
    status: 'pending',
  },
]);

const noRecords = buildTogetherWeekDaysV3({
  card: habit,
  entries: [],
  joinedAt,
  timezone: 'Asia/Seoul',
  now,
});

assert.equal(
  noRecords.find(
    (item) => item.localDate === '2026-10-10'
  ).status,
  'pending'
);

const routine = buildTogetherWeekDaysV3({
  card: {
    id: 'r1',
    type: 'rotation',
  },
  entries: [
    {
      timestamp: '2026-10-12T03:00:00Z',
      completedCycle: false,
    },
    {
      timestamp: '2026-10-13T03:00:00Z',
      completedCycle: true,
    },
  ],
  joinedAt,
  now,
});

assert.deepEqual(routine, [
  {
    localDate: '2026-10-10',
    status: 'pending',
  },
  {
    localDate: '2026-10-11',
    status: 'pending',
  },
  {
    localDate: '2026-10-12',
    status: 'pending',
  },
  {
    localDate: '2026-10-13',
    status: 'done',
  },
]);

const challengeDays = buildTogetherWeekDaysV3({
  card: {
    id: 'c1',
    type: 'challenge',
    startDate: '2026-10-12',
  },
  entries: [],
  joinedAt,
  now,
});

assert.deepEqual(challengeDays, [
  {
    localDate: '2026-10-10',
    status: 'off',
  },
  {
    localDate: '2026-10-11',
    status: 'off',
  },
  {
    localDate: '2026-10-12',
    status: 'pending',
  },
  {
    localDate: '2026-10-13',
    status: 'pending',
  },
]);

assert.equal(
  buildTogetherWeekDaysV3({
    card: habit,
    entries: records,
    now,
  }),
  null
);

for (const row of days) {
  assert.deepEqual(
    Object.keys(row).sort(),
    ['localDate', 'status']
  );
}

const sql = fs.readFileSync(
  'supabase/migrations/038_together_member_daily_v3.sql',
  'utf8'
);

assert.match(sql, /enable row level security/i);
assert.match(sql, /auth\.uid\(\)/);
assert.match(sql, /m\.status = 'active'/);
assert.match(sql, /r\.status = 'active'/);
assert.match(sql, /m\.joined_at/);
assert.match(sql, /on delete cascade/i);
assert.match(sql, /from public, anon, authenticated/i);
assert.match(sql, /limit 8/i);
assert.match(sql, /TOGETHER_DAY_RANGE_INVALID/);
assert.match(
  sql,
  /v_viewer_joined_at\s+timestamptz/
);
assert.match(
  sql,
  /select\s+r\.timezone,\s*me\.joined_at\s+into\s+v_timezone,\s*v_viewer_joined_at/i
);
assert.match(
  sql,
  /v_start\s*:=\s*greatest\([\s\S]*v_viewer_joined_at[\s\S]*v_timezone[\s\S]*\)::date\s*\)/
);
assert.match(
  sql,
  /m\.user_id\s*=\s*auth\.uid\(\)[\s\S]*or\s+d\.local_date\s*>\s*\(v_viewer_joined_at at time zone v_timezone\)::date/
);
assert.match(
  sql,
  /d\.local_date\s*>=\s*\(m\.joined_at at time zone v_timezone\)::date/
);
assert.match(
  sql,
  /me\.user_id\s*=\s*auth\.uid\(\)[\s\S]*me\.status\s*=\s*'active'[\s\S]*r\.status\s*=\s*'active'/
);
assert.match(
  sql,
  /jsonb_array_length\(p_days\)\s*>\s*7/
);

const remote = fs.readFileSync(
  'utils/togetherRemoteV2.js',
  'utf8'
);

assert.match(
  remote,
  /replaceTogetherMemberWeekV3/
);

assert.match(
  remote,
  /loadTogetherWeekV3/
);

console.log(
  'Together weekly records v3: PASS'
);

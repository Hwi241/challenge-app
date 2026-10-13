const assert = require('node:assert/strict');
const fs = require('node:fs');
const babel = require('@babel/core');
const filename = 'utils/togetherDailySyncV3.js';

const code = babel.transformSync(
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

const moduleObject = { exports: {} };

new Function(
  'require',
  'module',
  'exports',
  code
)(
  (name) => {
    if (name === './togetherRemoteV2') {
      return {
        loadTogetherRoomSnapshotV2: async () => null,
        replaceTogetherMemberWeekV3: async () => {},
      };
    }

    if (name === './togetherWeeklyRecordsV3') {
      return {
        loadTogetherWeekDaysV3: async () => [],
      };
    }

    if (name === './togetherRoomOverviewV3') {
      return {
        getTogetherRoomDateKeyV3: (value) =>
          new Date(value).toISOString().slice(0, 10),
      };
    }

    return require(name);
  },
  moduleObject,
  moduleObject.exports
);

const {
  createTogetherDailySyncV3,
} = moduleObject.exports;

(async () => {
  let snapshotCalls = 0;
  let writeCalls = 0;
  let failed = false;
  let joinedAt = '2026-10-10T10:00:00Z';

  let days = [{
    localDate: '2026-10-13',
    status: 'done',
  }];

  const requests = [];

  const create = () =>
    createTogetherDailySyncV3({
      loadSnapshot: async () => {
        snapshotCalls += 1;

        return {
          room: {
            id: 'room1',
            status: 'active',
            timezone: 'Asia/Seoul',
          },
          members: [{
            userId: 'user1',
            status: 'active',
            joinedAt,
          }],
        };
      },
      loadDays: async () => [...days],
      replaceWeek: async (request) => {
        writeCalls += 1;

        if (failed) {
          throw new Error('NETWORK_FAILURE');
        }

        requests.push(request);
      },
      dateKey: (value) =>
        new Date(value).toISOString().slice(0, 10),
    });

  const service = create();

  const input = {
    room: {
      timezone: 'Asia/Seoul',
      updated_at: 'version1',
    },
    binding: {
      roomId: 'room1',
      localChallengeId: 'push1',
    },
    userId: 'user1',
    now: Date.parse('2026-10-13T12:00:00Z'),
  };

  let result = await service.sync(input);

  assert.equal(result.synced, true);
  assert.equal(snapshotCalls, 1);
  assert.equal(writeCalls, 1);
  assert.deepEqual(requests[0], {
    roomId: 'room1',
    days: [{
      localDate: '2026-10-13',
      status: 'done',
    }],
  });

  result = await service.sync(input);

  assert.equal(result.reason, 'unchanged');
  assert.equal(snapshotCalls, 1);
  assert.equal(writeCalls, 1);

  days = [{
    localDate: '2026-10-13',
    status: 'pending',
  }];

  result = await service.sync(input);

  assert.equal(result.synced, true);
  assert.equal(snapshotCalls, 2);
  assert.equal(writeCalls, 2);

  days = [];

  result = await service.sync(input);

  assert.equal(result.synced, true);
  assert.deepEqual(
    requests.at(-1).days,
    []
  );

  days = [{
    localDate: '2026-10-13',
    status: 'done',
  }];

  failed = true;

  await assert.rejects(
    service.sync(input),
    /NETWORK_FAILURE/
  );

  const callsBeforeRetry = writeCalls;

  failed = false;

  result = await service.sync(input);

  assert.equal(result.synced, true);
  assert.equal(
    writeCalls,
    callsBeforeRetry + 1
  );

  result = await service.sync({
    ...input,
    now: Date.parse('2026-10-14T12:00:00Z'),
  });

  assert.equal(result.synced, true);

  service.prune({
    userId: 'user1',
    activeRoomIds: [],
  });

  const beforeRejoin = snapshotCalls;

  result = await service.sync(input);

  assert.equal(result.synced, true);
  assert.equal(
    snapshotCalls,
    beforeRejoin + 1
  );

  joinedAt = '2026-10-13T10:00:00Z';

  days = [{
    localDate: '2026-10-13',
    status: 'off',
  }];

  const previousSnapshots = snapshotCalls;

  result = await service.sync(input);

  assert.equal(result.synced, true);
  assert.equal(
    snapshotCalls,
    previousSnapshots + 1
  );

  const stateSync = fs.readFileSync(
    'utils/togetherStateSync.js',
    'utf8'
  );

  assert.match(
    stateSync,
    /togetherDailySyncV3\.sync/
  );

  assert.match(
    stateSync,
    /togetherDailySyncV3\.prune/
  );

  assert.match(
    stateSync,
    /upsertTogetherMemberStateV2/
  );

  assert.match(
    stateSync,
    /baselineContribution/
  );

  const v3Position = stateSync.search(
    /await\s+togetherDailySyncV3\.sync\s*\(/
  );

  const v2Position = stateSync.search(
    /await\s+upsertTogetherMemberStateV2\s*\(/
  );

  assert.ok(
    v3Position >= 0 && v2Position >= 0,
    'V2/V3 sync calls must exist'
  );

  assert.ok(
    v3Position < v2Position,
    'V3 must finish before V2 emits Realtime'
  );

  assert.doesNotMatch(
    filename + code,
    /entryText|imageUri|photoUri|memoText/
  );

  console.log(
    'Together daily sync v3: PASS'
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

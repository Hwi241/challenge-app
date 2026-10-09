const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');

const values = new Map();
const storage = {
  getItem: async (key) => (values.has(key) ? values.get(key) : null),
  setItem: async (key, value) => {
    values.set(key, String(value));
  },
  multiGet: async (keys) => keys.map((key) => [key, values.has(key) ? values.get(key) : null]),
  removeItem: async (key) => {
    values.delete(key);
  },
};

const cache = new Map();

function load(file) {
  const filename = path.resolve(__dirname, '..', file);
  if (cache.has(filename)) return cache.get(filename).exports;

  const module = { exports: {} };
  cache.set(filename, module);
  const source = fs.readFileSync(filename, 'utf8');
  const code = babel.transformSync(source, {
    filename,
    presets: [['babel-preset-expo', { jsxRuntime: 'automatic' }]],
    babelrc: false,
    configFile: false,
  }).code;

  const localRequire = (request) => {
    if (request === '@react-native-async-storage/async-storage') {
      return { __esModule: true, default: storage };
    }
    if (request.startsWith('.')) {
      const resolved = path.resolve(path.dirname(filename), request + (path.extname(request) ? '' : '.js'));
      return load(path.relative(path.resolve(__dirname, '..'), resolved));
    }
    return require(request);
  };

  vm.runInThisContext(
    `(function(require,module,exports){${code}\n})`,
    { filename }
  )(localRequire, module, module.exports);
  return module.exports;
}

(async () => {
  const together = load('utils/togetherLocalData.js');
  const now = new Date(2026, 9, 7, 12, 0, 0).getTime();
  const day = (offset, hour = 8) => new Date(2026, 9, 7 + offset, hour, 0, 0).toISOString();

  const activeChallenge = { id: 'c1', type: 'challenge', title: '매일 걷기', currentScore: 2, goalScore: 30 };
  const activeHabit = { id: 'h1', type: 'habit', title: '물 마시기', habitCycle: { type: 'weekly', days: ['월'] } };
  const activeRoutine = { id: 'r1', type: 'rotation', title: '아침 루틴' };
  const completed = { id: 'done', type: 'challenge', title: '완료', status: 'completed' };
  const goalReached = { id: 'goal', type: 'challenge', title: '목표 달성', currentScore: 10, goalScore: 10 };

  values.set('challenges', JSON.stringify([activeChallenge, activeHabit, activeRoutine, completed, goalReached]));
  const eligible = await together.loadTogetherEligibleCards({ storage, now });
  assert.deepEqual(eligible.map((card) => card.id), ['c1', 'h1', 'r1']);

  values.set('entries_c1', JSON.stringify([
    { id: 'e1', timestamp: day(0, 7), text: 'today' },
    { id: 'e2', timestamp: day(-1, 7), text: 'yesterday' },
    { id: 'e3', timestamp: day(-2, 7), text: 'before' },
  ]));

  const challengeSnapshot = await together.loadTogetherCardSnapshot({ challengeId: 'c1', storage, now });
  assert.equal(challengeSnapshot.title, '매일 걷기');
  assert.equal(challengeSnapshot.todayState, 'done');
  assert.equal(challengeSnapshot.streak, 3);
  assert.equal(challengeSnapshot.recentRecords.length, 3);
  assert.equal(challengeSnapshot.recentRecords[0].owner, '나');
  assert.equal(challengeSnapshot.recentRecords[0].description, '활동을 완료했어요.');

  values.set('entries_h1', JSON.stringify([]));
  const habitSnapshot = await together.loadTogetherCardSnapshot({ challengeId: 'h1', storage, now });
  assert.equal(habitSnapshot.typeLabel, '습관');
  assert.equal(habitSnapshot.todayState, 'off');

  values.set('entries_r1', JSON.stringify([
    { id: 'partial', timestamp: day(0, 6), text: 'partial', completedCycle: false },
    { id: 'cycle', timestamp: day(-1, 6), text: 'complete', completedCycle: true },
  ]));

  const routineSnapshot = await together.loadTogetherCardSnapshot({ challengeId: 'r1', storage, now });
  assert.equal(routineSnapshot.typeLabel, '루틴');
  assert.equal(routineSnapshot.todayState, 'pending');
  assert.equal(routineSnapshot.streak, 1);
  assert.equal(routineSnapshot.recentRecords.length, 1);
  console.log('together local data tests: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

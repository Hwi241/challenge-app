const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');

const values = new Map();
const storage = {
  getItem: async (key) => values.has(key) ? values.get(key) : null,
  setItem: async (key, value) => { values.set(key, String(value)); },
  removeItem: async (key) => { values.delete(key); },
  getAllKeys: async () => [...values.keys()],
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
    if (request === '@react-native-async-storage/async-storage') return { __esModule: true, default: storage };
    if (request.startsWith('.')) return load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), request + (path.extname(request) ? '' : '.js'))));
    return require(request);
  };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(localRequire, module, module.exports);
  return module.exports;
}

(async () => {
  const progress = load('utils/growthProgress.js');
  const rewards = load('utils/growthRewards.js');
  const milestones = load('utils/growthMilestones.js');
  const wallet = load('utils/starWallet.js');
  const migration = load('utils/growthMigration.js');

  [[0, 1], [29, 1], [30, 2], [3990, 20], [8990, 30], [24990, 50]].forEach(([xp, level]) => assert.equal(progress.getLevelFromXp(xp), level));
  [[1, 0], [2, 30], [3, 80], [5, 240], [8, 630], [10, 990], [15, 2240], [20, 3990], [30, 8990], [50, 24990]].forEach(([level, xp]) => assert.equal(progress.getXpForLevel(level), xp));
  [[19, 0], [20, .05], [29, .05], [30, .1], [49, .1], [50, .3]].forEach(([level, rate]) => assert.equal(progress.getStarPurchaseDiscountRate(level), rate));

  const day1 = new Date('2026-09-29T12:00:00Z').getTime();
  const day2 = new Date('2026-09-30T12:00:00Z').getTime();
  const firstChallenge = await rewards.rewardChallengeEntry({ activityId: 'c1', occurredAt: day1, now: day1 });
  assert.equal(firstChallenge.xp, 5);
  assert.equal(firstChallenge.stars, 1);
  assert.equal((await rewards.rewardChallengeEntry({ activityId: 'c1', occurredAt: day1, now: day1 })).xp, 0);
  assert.equal((await rewards.rewardChallengeEntry({ activityId: 'c1', occurredAt: day2, now: day2 })).xp, 5);
  assert.equal((await rewards.rewardHabitCompletion({ activityId: 'h1', occurredAt: day1, now: day2 })).reason, 'not_today');

  values.clear();
  for (const [minutes, expectedXp, expectedStars] of [[9, 0, 0], [10, 2, 0], [25, 4, 1], [50, 6, 2]]) {
    const output = await rewards.rewardFocusSession({ sessionId: `f${minutes}`, durationSeconds: minutes * 60, occurredAt: day1, now: day1 });
    assert.equal(output.xp, expectedXp);
    assert.equal(output.stars, expectedStars);
    values.clear();
  }
  for (let index = 0; index < 3; index += 1) await rewards.rewardFocusSession({ sessionId: `cap${index}`, durationSeconds: 50 * 60, occurredAt: day1, now: day1 });
  const daily = JSON.parse(values.get(rewards.GROWTH_REWARD_KEYS.daily));
  assert.equal(daily.focusTotals['2026-09-29'].xp, 12);
  assert.equal(daily.focusTotals['2026-09-29'].stars, 2);

  values.clear();
  let adTotal = 0;
  for (let index = 1; index <= 10; index += 1) adTotal += (await wallet.grantRewardedAdStars()).amount;
  assert.equal(adTotal, 12);
  assert.equal((await wallet.grantRewardedAdStars()).reason, 'daily_limit');
  assert.equal((await wallet.getRewardedAdStatus()).completed, true);

  values.clear();
  const concurrentAds = await Promise.all(Array.from({ length: 12 }, () => wallet.grantRewardedAdStars()));
  assert.equal(concurrentAds.reduce((sum, item) => sum + item.amount, 0), 12);
  assert.equal(concurrentAds.filter((item) => item.reason === 'daily_limit').length, 2);

  values.clear();
  const dates = Array.from({ length: 100 }, (_, index) => {
    const date = new Date(day1); date.setUTCDate(date.getUTCDate() - index);
    return rewards.getGrowthLocalDateKey(date);
  });
  assert.equal((await milestones.applyActivityMilestones(dates, day1)).awarded.length, 3);
  assert.equal((await milestones.applyActivityMilestones(dates, day1)).awarded.length, 0);
  assert.equal((await progress.getGrowthProgress()).totalXp, 155);
  assert.equal(await wallet.getStarBalance(), 31);

  values.clear();
  values.set('challenges', JSON.stringify([{ id: 'c1', type: 'challenge' }]));
  values.set('entries_c1', JSON.stringify([{ timestamp: day1 }, { timestamp: day1 }]));
  assert.equal((await migration.migrateExistingGrowthData(day1)).calculatedXp, 5);
  assert.equal((await migration.migrateExistingGrowthData(day1)).migrated, false);
  assert.equal((await rewards.rewardChallengeEntry({ activityId: 'c1', occurredAt: day1, now: day1 })).reason, 'already_rewarded');
  assert.equal(await wallet.getStarBalance(), 0);
  console.log('growth tests: PASS');
})().catch((error) => { console.error(error); process.exitCode = 1; });

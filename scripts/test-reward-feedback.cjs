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
    if (request === '@react-native-async-storage/async-storage') {
      return { __esModule: true, default: storage };
    }
    if (request.startsWith('.')) {
      const resolved = path.resolve(
        path.dirname(filename),
        request + (path.extname(request) ? '' : '.js')
      );
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
  const feedback = load('utils/rewardFeedback.js');
  const progress = load('utils/growthProgress.js');
  const wallet = load('utils/starWallet.js');
  const events = [];

  const unsubscribe = feedback.subscribeRewardFeedback((event) => {
    events.push({ kind: event.kind, amount: event.amount });
  });

  await progress.addGrowthXp(5, { reason: 'test_xp' });
  await wallet.grantStars(1, 'test_star');

  assert.deepEqual(events.slice(0, 2), [
    { kind: 'xp', amount: 5 },
    { kind: 'star', amount: 1 },
  ]);

  const beforeSpend = events.length;
  await wallet.spendStars(1, 'test_spend');
  assert.equal(events.length, beforeSpend);

  unsubscribe();
  feedback.emitRewardFeedback('xp', 3);
  const queued = [];
  const unsubscribeQueued = feedback.subscribeRewardFeedback((event) => {
    queued.push({ kind: event.kind, amount: event.amount });
  });

  assert.deepEqual(queued, [{ kind: 'xp', amount: 3 }]);
  unsubscribeQueued();

  console.log('reward feedback tests: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');

const values = new Map();
const storage = {
  getItem: async (key) => (values.has(key) ? values.get(key) : null),
  setItem: async (key, value) => values.set(key, String(value)),
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
    if (request.startsWith('.')) {
      const resolved = path.resolve(path.dirname(filename), request + (path.extname(request) ? '' : '.js'));
      return load(path.relative(path.resolve(__dirname, '..'), resolved));
    }
    return require(request);
  };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(localRequire, module, module.exports);
  return module.exports;
}

(async () => {
  const draftsApi = load('utils/togetherRoomDrafts.js');
  const first = await draftsApi.createOrReuseTogetherRoomDraft({ card: { id: 'h1', type: 'habit', title: '물 마시기' }, storage, now: 1000 });
  assert.equal(first.status, 'draft');
  assert.equal(first.challengeId, 'h1');
  assert.equal(first.title, '물 마시기');
  assert.equal(first.typeLabel, '습관');
  assert.equal(first.sharePolicy, 'completion_only');
  let drafts = await draftsApi.loadTogetherRoomDrafts({ storage });
  assert.equal(drafts.length, 1);
  const reused = await draftsApi.createOrReuseTogetherRoomDraft({ card: { id: 'h1', type: 'habit', title: '물 마시기 수정' }, storage, now: 2000 });
  assert.equal(reused.id, first.id);
  assert.equal(reused.title, '물 마시기 수정');
  assert.equal(reused.updatedAt, 2000);
  drafts = await draftsApi.loadTogetherRoomDrafts({ storage });
  assert.equal(drafts.length, 1);
  const loaded = await draftsApi.loadTogetherRoomDraftById({ draftId: first.id, storage });
  assert.equal(loaded.id, first.id);
  assert.equal(loaded.challengeId, 'h1');
  await draftsApi.createOrReuseTogetherRoomDraft({ card: { id: 'c2', type: 'challenge', title: '30분 걷기' }, storage, now: 3000 });
  drafts = await draftsApi.loadTogetherRoomDrafts({ storage });
  assert.equal(drafts.length, 2);
  assert.equal(drafts[0].challengeId, 'c2');
  assert.equal(drafts[1].challengeId, 'h1');
  console.log('together room draft tests: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

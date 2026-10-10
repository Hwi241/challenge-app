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
    if (request === './togetherRemoteRooms') return {
      createTogetherRemoteRoom: async () => { throw new Error('UNEXPECTED_DEFAULT_REMOTE_CALL'); },
    };
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
  const api = load('utils/togetherInvitations.js');
  const draft = {
    id: 'together_draft_test',
    status: 'draft',
    challengeId: 'local_challenge_123',
    title: '매일 30분 걷기',
    typeLabel: '습관',
    sharePolicy: 'completion_only',
    createdAt: 500,
  };
  let remoteCalls = 0;
  const remoteRoomFactory = async () => {
    remoteCalls += 1;
    return {
      roomId: 'server-room-1',
      inviteToken: 'server-invite-token-1',
      inviteExpiresAt: '2026-10-17T00:00:00+00:00',
    };
  };
  const first = await api.createOrReuseTogetherInvitation({ draft, storage, now: 1000, remoteRoomFactory });
  assert.equal(api.TOGETHER_INVITATION_VERSION, 2);
  assert.equal(first.id, 'server-invite-token-1');
  assert.equal(first.serverRoomId, 'server-room-1');
  assert.equal(first.inviteExpiresAt, '2026-10-17T00:00:00+00:00');
  assert.equal(first.draftId, draft.id);
  assert.equal(first.challengeId, draft.challengeId);
  assert.equal(first.sharePolicy, 'completion_only');
  assert.match(first.link, /^thepush:\/\/together\/invite\?data=/);
  assert.equal(remoteCalls, 1);
  assert.equal(first.payload.version, 2);
  assert.equal(first.payload.invitationId, 'server-invite-token-1');
  assert.equal(first.payload.title, '매일 30분 걷기');
  assert.equal(first.payload.typeLabel, '습관');
  assert.equal(first.payload.sharePolicy, 'completion_only');
  assert.equal(Object.prototype.hasOwnProperty.call(first.payload, 'challengeId'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(first.payload, 'draftId'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(first.payload, 'serverRoomId'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(first.payload, 'inviteExpiresAt'), false);
  assert.deepEqual(Object.keys(first.payload).sort(), ['version', 'invitationId', 'title', 'typeLabel', 'sharePolicy', 'createdAt'].sort());
  const decoded = api.parseTogetherInvitationLink(first.link);
  assert.deepEqual(decoded, first.payload);
  assert.deepEqual(Object.keys(decoded).sort(), ['version', 'invitationId', 'title', 'typeLabel', 'sharePolicy', 'createdAt'].sort());
  assert.equal(Object.prototype.hasOwnProperty.call(decoded, 'challengeId'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(decoded, 'draftId'), false);
  const storedAfterFirst = await api.loadTogetherInvitations({ storage });
  assert.equal(storedAfterFirst.length, 1);
  assert.equal(storedAfterFirst[0].id, first.id);
  assert.equal(storedAfterFirst[0].serverRoomId, 'server-room-1');
  assert.deepEqual(storedAfterFirst[0].payload, first.payload);
  assert.equal(storedAfterFirst[0].challengeId, draft.challengeId);
  assert.equal(storedAfterFirst[0].draftId, draft.id);
  const reused = await api.createOrReuseTogetherInvitation({ draft: { ...draft, title: '매일 40분 걷기' }, storage, now: 2000, remoteRoomFactory });
  assert.equal(reused.id, first.id);
  assert.equal(reused.serverRoomId, first.serverRoomId);
  assert.equal(reused.createdAt, first.createdAt);
  assert.equal(reused.updatedAt, 2000);
  assert.equal(reused.title, '매일 40분 걷기');
  assert.equal(remoteCalls, 1);
  const invitations = await api.loadTogetherInvitations({ storage });
  assert.equal(invitations.length, 1);
  const byDraft = await api.loadTogetherInvitationByDraftId({ draftId: draft.id, storage });
  assert.equal(byDraft.id, first.id);
  assert.equal(byDraft.serverRoomId, 'server-room-1');
  assert.equal(values.size, 1);
  assert.equal(values.has(api.TOGETHER_INVITATIONS_KEY), true);
  assert.equal(api.parseTogetherInvitationLink('https://example.com'), null);
  assert.equal(api.parseTogetherInvitationLink('thepush://together/invite?data=broken'), null);
  console.log('together invitation tests: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'utils', 'togetherRemoteRooms.js');
const source = fs.readFileSync(filename, 'utf8');

const loadModule = () => {
  const code = babel.transformSync(source, {
    filename,
    presets: [['babel-preset-expo', { jsxRuntime: 'automatic' }]],
    babelrc: false,
    configFile: false,
  }).code;
  const moduleObject = { exports: {} };
  const localRequire = (request) => request === './supabaseClient'
    ? { getSupabaseClient: () => null }
    : require(request);
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(
    localRequire,
    moduleObject,
    moduleObject.exports
  );
  return moduleObject.exports;
};

(async () => {
  const api = loadModule();
  {
    const calls = [];
    const client = { rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: [{
        room_id: 'room-1',
        invite_token: 'token-1',
        invite_expires_at: '2026-10-17T00:00:00+00:00',
      }], error: null };
    } };
    const room = await api.createTogetherRemoteRoom({ client });
    assert.deepEqual(room, {
      roomId: 'room-1',
      inviteToken: 'token-1',
      inviteExpiresAt: '2026-10-17T00:00:00+00:00',
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].name, 'create_together_room');
    assert.equal(calls[0].args, undefined);
  }
  {
    const calls = [];
    const client = { rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: 'room-2', error: null };
    } };
    const room = await api.acceptTogetherRemoteInvite({ client, inviteToken: 'token-2' });
    assert.deepEqual(room, { roomId: 'room-2' });
    assert.equal(calls[0].name, 'accept_together_invite');
    assert.deepEqual(calls[0].args, { p_invite_token: 'token-2' });
  }
  await assert.rejects(
    () => api.createTogetherRemoteRoom({ client: { rpc: async () => ({ data: null, error: { message: 'rpc failed' } }) } }),
    /rpc failed/
  );
  await assert.rejects(
    () => api.acceptTogetherRemoteInvite({ client: { rpc: async () => ({ data: null, error: null }) }, inviteToken: 'token' }),
    /TOGETHER_REMOTE_INVITE_INVALID_RESPONSE/
  );
  console.log('Together remote room tests: PASS');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

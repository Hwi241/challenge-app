const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');

const filename = path.resolve(__dirname, '../utils/togetherRemoteV2.js');
const code = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
  filename,
  presets: [['babel-preset-expo', { jsxRuntime: 'automatic' }]],
  babelrc: false,
  configFile: false,
}).code;
const moduleObject = { exports: {} };
vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(
  (request) => {
    if (request === './supabaseClient') return { getSupabaseClient: () => null };
    if (request === './togetherRemoteAuth') return { ensureTogetherAnonymousSession: async () => ({}) };
    return require(request);
  },
  moduleObject,
  moduleObject.exports
);
const api = moduleObject.exports;

(async () => {
  const calls = [];
  const client = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === 'create_together_room_v2') return { data: [{ room_id: 'room-1', invite_code: 'ABCD1234', invite_expires_at: '2026-10-17T00:00:00Z' }], error: null };
      if (name === 'get_my_together_rooms_v2') return { data: [{ room_id: 'room-1' }], error: null };
      return { data: { roomId: 'room-1', joinStatus: 'active' }, error: null };
    },
  };
  assert.deepEqual(await api.createTogetherRoomV2({ mode: 'watch', title: '걷기', timezone: 'Asia/Seoul', pushTemplate: { version: 1 }, requestId: 'request-1', displayName: '멤버', client }), {
    roomId: 'room-1', inviteCode: 'ABCD1234', inviteExpiresAt: '2026-10-17T00:00:00Z',
  });
  assert.deepEqual(calls[0], { name: 'create_together_room_v2', args: { p_mode: 'watch', p_title: '걷기', p_timezone: 'Asia/Seoul', p_push_template: { version: 1 }, p_shared_goal: null, p_client_request_id: 'request-1', p_display_name: '멤버' } });
  await api.getTogetherInvitePreviewV2({ code: 'ABCD1234', client });
  await api.acceptTogetherInviteV2({ code: 'ABCD1234', displayName: '멤버', client });
  await api.upsertTogetherMemberStateV2({ roomId: 'room-1', localDate: '2026-10-10', completed: true, progress: 0.5, streak: 2, contribution: 3, displayName: '멤버', client });
  assert.deepEqual(calls.at(-1), { name: 'upsert_together_member_state_v2', args: { p_room_id: 'room-1', p_local_date: '2026-10-10', p_completed: true, p_progress: 0.5, p_streak: 2, p_contribution: 3, p_display_name: '멤버' } });
  assert.equal(JSON.stringify(calls).includes('challengeId'), false);

  const subscriptions = [];
  const channel = { on(event, config, callback) { subscriptions.push({ event, config, callback }); return this; }, subscribe() { return this; } };
  let removed = null;
  const realtime = { channel: () => channel, removeChannel: (value) => { removed = value; } };
  let changes = 0;
  const unsubscribe = api.subscribeTogetherRoomV2({ roomId: 'room-1', onChange: () => { changes += 1; }, client: realtime });
  assert.deepEqual(subscriptions.map((item) => item.config.table), ['together_rooms', 'together_room_members', 'together_member_states']);
  subscriptions[0].callback();
  assert.equal(changes, 1);
  unsubscribe();
  assert.equal(removed, channel);
  console.log('Together v2 remote tests: PASS');
})().catch((error) => { console.error(error); process.exitCode = 1; });

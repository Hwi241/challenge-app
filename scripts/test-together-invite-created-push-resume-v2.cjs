const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..');
const filename = path.join(root, 'utils/togetherInviteCreatedPushResumeV2.js');
const transformed = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
  filename,
  presets: [['babel-preset-expo', { jsxRuntime: 'automatic' }]],
  babelrc: false,
  configFile: false,
}).code;
const moduleRef = { exports: {} };
new Function('module', 'exports', 'require', transformed)(moduleRef, moduleRef.exports, require);
const { resolveTogetherCreatedPushResumeV2 } = moduleRef.exports;

const cards = [
  { id: 'ch_new_1', title: '신규 도전' },
  { id: 'rotation_new_2', title: '신규 루틴' },
];
const ready = (mode, id) => resolveTogetherCreatedPushResumeV2({
  result: { roomId: 'room_1', mode, joinStatus: 'active' },
  createdPushId: id,
  cards,
});

assert.equal(ready('paired_push', 'ch_new_1').status, 'ready');
assert.equal(ready('shared_goal', 'rotation_new_2').status, 'ready');
assert.equal(ready('paired_push', 'missing').status, 'card-not-found');
assert.equal(resolveTogetherCreatedPushResumeV2({ result: { roomId: 'room_1', mode: 'paired_push', joinStatus: 'pending' }, createdPushId: 'ch_new_1', cards }).status, 'invalid-acceptance');
assert.equal(resolveTogetherCreatedPushResumeV2({ result: null, createdPushId: 'ch_new_1', cards }).status, 'invalid-acceptance');
assert.equal(resolveTogetherCreatedPushResumeV2({ result: { roomId: 'room_1', mode: 'same_push', joinStatus: 'active' }, createdPushId: 'ch_new_1', cards }).status, 'invalid-acceptance');

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const accept = read('screens/TogetherInviteAcceptScreen.js');
const typeScreen = read('screens/CreateChallengeTypeScreen.js');
const challenge = read('screens/AddChallengeScreen.js');
const rotation = read('screens/AddRotationRoutineScreen.js');
assert.match(accept, /returnToTogetherInviteAccept/);
assert.match(accept, /resolveTogetherCreatedPushResumeV2/);
assert.match(accept, /createdPushResumeConsumedRef/);
assert.match(accept, /bindCard/);
assert.match(typeScreen, /returnToTogetherInviteAccept/);
assert.match(challenge, /returnToTogetherInviteAccept/);
assert.match(rotation, /returnToTogetherInviteAccept/);
assert.match(challenge, /TogetherInviteAccept/);
assert.match(rotation, /TogetherInviteAccept/);
assert.match(challenge, /merge:\s*true/);
assert.match(rotation, /merge:\s*true/);

console.log('Together invite created PUSH resume v2: PASS');

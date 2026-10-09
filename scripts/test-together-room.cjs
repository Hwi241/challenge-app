const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const app = read('App.js');
const home = read('screens/TogetherScreen.js');
const detail = read('screens/TogetherRoomDetailScreen.js');

assert.match(app, /TogetherRoomDetailScreen/);
assert.match(app, /name="TogetherRoomDetail"/);
assert.doesNotMatch(app, /TogetherRoomDetail:\s*'/);
assert.match(home, /TOGETHER_PREVIEW_ROOMS = \[\]/);
assert.match(home, /loadTogetherAcceptableChallenges/);
assert.match(home, /TogetherPushPickerModal/);
assert.match(home, /TogetherConfirmSheet/);
assert.match(home, /createOrReuseTogetherRoomDraft/);
assert.match(home, /TogetherInviteDraft/);
assert.match(home, /초대 준비 중/);
assert.match(detail, /함께방/);
assert.match(detail, /1:1 함께/);
assert.match(detail, /함께 이어가는 중/);
assert.match(detail, /오늘 완료/);
assert.match(detail, /최근 기록/);
assert.match(detail, /상대가 완료하면 이곳에서 바로 확인할 수 있어요/);
assert.match(detail, /loadTogetherCardSnapshot/);
assert.match(detail, /localSnapshot/);
assert.match(detail, /내 활동 연속 기록/);
assert.match(detail, /실제 기록을 기준으로 표시/);
assert.doesNotMatch(detail, /AsyncStorage/);
assert.doesNotMatch(detail, /댓글/);
assert.doesNotMatch(detail, /좋아요/);

console.log('together room detail tests: PASS');

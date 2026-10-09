const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const lifecycle = fs.readFileSync(path.join(root, 'utils', 'togetherLocalLifecycle.js'), 'utf8');
const home = fs.readFileSync(path.join(root, 'screens', 'TogetherScreen.js'), 'utf8');
const card = fs.readFileSync(path.join(root, 'components', 'TogetherAcceptedRoomCard.js'), 'utf8');
const detail = fs.readFileSync(path.join(root, 'components', 'TogetherAcceptedRoomDetail.js'), 'utf8');
const inviteDraft = fs.readFileSync(path.join(root, 'screens', 'TogetherInviteDraftScreen.js'), 'utf8');

assert.match(lifecycle, /together_room_drafts_v1/);
assert.match(lifecycle, /together_accepted_rooms_v1/);
assert.match(lifecycle, /cancelTogetherRoomDraft/);
assert.match(lifecycle, /disconnectTogetherAcceptedRoom/);
assert.match(lifecycle, /reconcileTogetherAcceptedRooms/);
assert.match(lifecycle, /seen\.has/);
assert.match(home, /reconcileTogetherAcceptedRooms/);
assert.match(home, /sourceAvailable/);
assert.match(card, /활동 확인 필요/);
assert.match(card, /활동 확인/);
assert.match(detail, /disconnectTogetherAcceptedRoom/);
assert.match(detail, /함께 활동 연결 해제/);
assert.match(detail, /연결한 내 활동을 확인해주세요/);
assert.match(detail, /삭제되었거나/);
assert.match(inviteDraft, /cancelTogetherRoomDraft/);
assert.match(inviteDraft, /초대 준비 취소/);
assert.doesNotMatch(detail, /상대가 오늘 완료/);
assert.doesNotMatch(detail, /partnerStreak/);

console.log('Together local lifecycle source tests: PASS');

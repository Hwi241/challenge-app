const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('App.js');
const appConfig = JSON.parse(read('app.json'));
const home = read('screens/TogetherScreen.js');
const picker = read('components/TogetherPushPickerModal.js');
const inviteScreen = read('screens/TogetherInviteDraftScreen.js');
const drafts = read('utils/togetherRoomDrafts.js');
const invitations = read('utils/togetherInvitations.js');
const packageJson = JSON.parse(read('package.json'));

assert.match(app, /TogetherInviteDraftScreen/);
assert.match(app, /name="TogetherInviteDraft"/);
assert.match(home, /TogetherPushPickerModal/);
assert.match(home, /TogetherConfirmSheet/);
assert.match(home, /modalRoot/);
assert.match(home, /confirmSheet/);
assert.match(home, /TogetherDraftCard/);
assert.match(picker, /함께할 PUSH 선택/);
assert.match(
  picker,
  /createButtonPlus/
);

assert.match(
  picker,
  /buttonStyles\.secondary\.container/
);

assert.match(
  picker,
  /buttonStyles\.secondary\.label/
);

assert.match(
  picker,
  /PUSH 만들기/
);
assert.match(home, /이 활동으로 시작/);
assert.match(home, /이 활동을 친구와 함께 이어갈까요\?/);
assert.match(home, /다른 활동 선택/);
assert.match(home, /createOrReuseTogetherRoomDraft/);
assert.match(home, /loadTogetherRoomDrafts/);
assert.match(home, /초대 준비 중/);
assert.match(home, /TogetherInviteDraft/);
assert.doesNotMatch(home, /TogetherStartSheet/);
assert.doesNotMatch(home, /TOGETHER_ROOM_PREVIEW/);
assert.doesNotMatch(home, /AsyncStorage/);

const modalRootMatch = home.match(
  /modalRoot:\s*\{([\s\S]*?)\},\s*modalBackdrop:/
);

const confirmSheetMatch = home.match(
  /confirmSheet:\s*\{([\s\S]*?)\},\s*confirmEyebrow:/
);

assert.ok(modalRootMatch, 'modalRoot style missing');
assert.ok(confirmSheetMatch, 'confirmSheet style missing');
assert.match(modalRootMatch[1], /alignItems:\s*['"]center['"]/);
assert.match(modalRootMatch[1], /justifyContent:\s*['"]center['"]/);
assert.match(confirmSheetMatch[1], /maxWidth:\s*520/);
assert.match(confirmSheetMatch[1], /maxHeight:\s*['"]70%['"]/);
assert.match(confirmSheetMatch[1], /borderRadius:\s*20/);
assert.match(confirmSheetMatch[1], /elevation:\s*12/);
assert.doesNotMatch(modalRootMatch[1], /justifyContent:\s*['"]flex-end['"]/);
assert.doesNotMatch(confirmSheetMatch[1], /borderTopLeftRadius|borderTopRightRadius|sheetHandle/);
assert.doesNotMatch(home, /sheetHandle/);
assert.equal(appConfig?.expo?.scheme, 'thepush');
assert.match(inviteScreen, /친구 초대/);
assert.match(inviteScreen, /초대 링크 만들기/);
assert.match(inviteScreen, /TogetherQrCode/);
assert.match(inviteScreen, /Clipboard\.setStringAsync/);
assert.match(inviteScreen, /Share\.share/);
assert.match(inviteScreen, /링크 복사/);
assert.match(inviteScreen, /공유하기/);
assert.match(inviteScreen, /초대 QR/);
assert.match(inviteScreen, /개인 기록은 공유하지 않아요/);
assert.match(inviteScreen, /createOrReuseTogetherInvitation/);
assert.match(inviteScreen, /loadTogetherInvitationByDraftId/);
assert.match(drafts, /together_room_drafts_v1/);
assert.match(drafts, /completion_only/);
assert.match(invitations, /together_invitations_v1/);
assert.match(invitations, /thepush:\/\/together\/invite\?data=/);
assert.match(invitations, /completion_only/);
assert.match(invitations, /normalizePublicPayload/);
assert.match(invitations, /raw\.v[\s\S]*raw\.version/);
assert.match(invitations, /raw\.i[\s\S]*raw\.invitationId/);
assert.match(invitations, /raw\.t[\s\S]*raw\.title/);
assert.match(invitations, /raw\.k[\s\S]*raw\.typeLabel/);
assert.match(invitations, /raw\.p[\s\S]*raw\.sharePolicy/);
assert.match(invitations, /raw\.c[\s\S]*raw\.createdAt/);
assert.equal(packageJson.dependencies['expo-clipboard'], '~57.0.2');
console.log('together start flow tests: PASS');

const assert =
  require('node:assert/strict');

const fs =
  require('node:fs');

const path =
  require('node:path');

const root =
  path.resolve(
    __dirname,
    '..'
  );

const picker =
  fs.readFileSync(
    path.join(root, 'components', 'TogetherPushPickerModal.js'),
    'utf8'
  );

const together =
  fs.readFileSync(
    path.join(root, 'screens', 'TogetherScreen.js'),
    'utf8'
  );

const lifecycle =
  fs.readFileSync(
    path.join(root, 'utils', 'togetherLocalLifecycle.js'),
    'utf8'
  );

const inviteDraft =
  fs.readFileSync(
    path.join(root, 'screens', 'TogetherInviteDraftScreen.js'),
    'utf8'
  );

assert.match(picker, /<Modal/);
assert.match(picker, /함께할 PUSH 선택/);
assert.match(picker, /\+PUSH 만들기/);
assert.match(picker, /함께할 수 있는 PUSH가 없어요/);
assert.match(picker, /이미 초대 준비 중이거나/);
assert.match(together, /TogetherPushPickerModal/);
assert.match(together, /loadTogetherAcceptableChallenges/);
assert.match(together, /loadTogetherReservedChallengeIds/);
assert.match(together, /reservedIds\.has/);
assert.match(together, /CreateChallengeType/);
assert.match(lifecycle, /loadTogetherReservedChallengeIds/);
assert.match(lifecycle, /status\s*!==\s*['"]draft['"]/);
assert.match(lifecycle, /status\s*!==\s*['"]accepted_local['"]/);
assert.match(inviteDraft, /useSafeAreaInsets/);
assert.match(inviteDraft, /insets\.bottom\s*\+\s*72/);
assert.match(inviteDraft, /96/);

console.log(
  'Together PUSH picker tests: PASS'
);

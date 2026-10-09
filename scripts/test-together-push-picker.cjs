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
assert.match(picker, /buttonStyles/);
assert.match(picker, /buttonStyles\.secondary\.container/);
assert.match(picker, /buttonStyles\.secondary\.label/);
assert.match(picker, /PUSH 만들기/);
assert.match(picker, /createButtonPlus/);
assert.doesNotMatch(picker, /radius\.button/);
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

assert.match(
  picker,
  /justifyContent:\s*['"]center['"]/
);

assert.match(
  picker,
  /alignItems:\s*['"]center['"]/
);

assert.match(
  picker,
  /maxWidth:\s*520/
);

assert.match(
  picker,
  /maxHeight:\s*['"]70%['"]/
);

assert.match(
  picker,
  /borderRadius:\s*20/
);

assert.match(
  picker,
  /elevation:\s*12/
);

assert.doesNotMatch(
  picker,
  /justifyContent:\s*['"]flex-end['"]/
);

assert.doesNotMatch(
  picker,
  /styles\.handle/
);

assert.doesNotMatch(
  picker,
  /borderTopLeftRadius/
);

assert.doesNotMatch(
  picker,
  /borderTopRightRadius/
);

console.log(
  'Together PUSH picker tests: PASS'
);

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const read = (file) =>
  fs.readFileSync(
    path.join(root, file),
    'utf8'
  );

const entry = read(
  'screens/TogetherJoinEntryScreen.js'
);

const app = read('App.js');

const home = read(
  'screens/TogetherScreen.js'
);

const qr = read(
  'screens/TogetherQrScanScreen.js'
);

assert.match(
  app,
  /name="TogetherJoinEntry"/
);

assert.match(
  entry,
  /parseTogetherInviteCode\(input\)/
);

assert.match(
  entry,
  /Clipboard\.getStringAsync/
);

assert.match(
  entry,
  /초대 코드 또는 링크/
);

assert.match(
  entry,
  /초대 확인하기/
);

assert.match(
  entry,
  /TogetherInviteAccept/
);

assert.match(
  entry,
  /TogetherQrScan/
);

assert.match(
  home,
  /openJoinEntry/
);

assert.match(
  home,
  /onJoin=\{openJoinEntry\}/
);

assert.match(
  home,
  /TogetherJoinEntry/
);

assert.match(
  qr,
  /parseTogetherInviteCode/
);

assert.doesNotMatch(
  entry,
  /acceptTogetherInviteV2\s*\(/
);

console.log(
  'Together join entry UI: PASS'
);

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const filename = path.resolve(
  __dirname,
  '../screens/TogetherRoomManageScreen.js'
);

const source = fs.readFileSync(
  filename,
  'utf8'
);

assert.match(
  source,
  /getExistingTogetherSession/
);

assert.match(
  source,
  /TOGETHER_MANAGE_SNAPSHOT_INVALID/
);

assert.match(
  source,
  /setLoadError/
);

assert.match(
  source,
  /runManageAction/
);

assert.match(
  source,
  /reportManageActionError/
);

assert.doesNotMatch(
  source,
  /\broom\.myUserId\b/
);

assert.doesNotMatch(
  source,
  /load\(\)\.catch\(\(\)\s*=>\s*\{\s*\}\)/
);

assert.match(
  source,
  /다시 시도/
);

console.log(
  'Together manage safety: PASS'
);

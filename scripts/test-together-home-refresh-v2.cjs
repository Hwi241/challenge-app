const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.resolve(
    __dirname,
    '../screens/TogetherScreen.js'
  ),
  'utf8'
);

assert.match(source, /RefreshControl/);
assert.match(source, /refreshing=\{refreshing\}/);
assert.match(source, /manual:\s*true/);
assert.match(source, /Promise\.allSettled/);
assert.match(source, /reloadSequenceRef/);
assert.match(source, /homeActiveRef/);
assert.match(source, /homeInitialLoaded/);
assert.match(source, /homeLoadError/);
assert.match(source, /loadTogetherRoomDraftsV2/);
assert.match(source, /loadMyTogetherRoomsV2/);
assert.match(source, /getExistingTogetherSession/);
assert.match(source, /다시 시도/);
assert.doesNotMatch(
  source,
  /catch\s*\{\s*setRooms\(\[\]\)/
);

console.log('Together home refresh v2: PASS');

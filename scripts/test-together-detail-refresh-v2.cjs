const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const source = fs.readFileSync(
  path.join(
    root,
    'screens/TogetherRoomDetailScreen.js'
  ),
  'utf8'
);

assert.match(source, /RefreshControl/);
assert.match(source, /refreshing=\{refreshing\}/);
assert.match(source, /manual:\s*true/);
assert.match(source, /useFocusEffect/);
assert.match(source, /requestSequenceRef/);
assert.match(source, /screenActiveRef/);
assert.match(source, /TOGETHER_ROOM_SNAPSHOT_INVALID/);
assert.match(source, /setSnapshot\(nextSnapshot\)/);
assert.match(source, /subscribeTogetherRoomV2/);
assert.match(source, /unsubscribe\(\)/);
assert.match(source, /loadTogetherProgressMetrics/);
assert.match(source, /다시 시도/);
assert.doesNotMatch(
  source,
  /load\(\)\.catch\(\(\)\s*=>\s*\{\s*\}\)/
);

console.log('Together detail refresh v2: PASS');

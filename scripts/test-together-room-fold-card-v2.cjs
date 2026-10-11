const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const read = (file) =>
  fs.readFileSync(
    path.join(root, file),
    'utf8'
  );

const card = read(
  'components/TogetherRoomFoldCardV2.js'
);

const store = read(
  'utils/togetherRoomCardCollapseV2.js'
);

const home = read(
  'screens/TogetherScreen.js'
);

assert.match(
  card,
  /CARD_COMPACT_HEIGHT\s*=\s*64/
);

assert.match(
  card,
  /CARD_EXPANDED_HEIGHT\s*=\s*224/
);

assert.match(
  card,
  /backgroundColor:\s*primitive\.black/
);

assert.match(
  card,
  /borderRadius:\s*radius\.card/
);

assert.match(
  card,
  /onToggleCollapsed/
);

assert.match(
  card,
  /onOpen/
);

assert.match(
  card,
  /variant === 'draft'/
);

assert.match(
  store,
  /together_collapsed_room_ids_v1/
);

assert.match(
  store,
  /loadTogetherCollapsedRoomsV2/
);

assert.match(
  store,
  /saveTogetherCollapsedRoomsV2/
);

assert.match(
  home,
  /TogetherRoomFoldCardV2/
);

assert.match(
  home,
  /toggleTogetherCollapsed/
);

assert.match(
  home,
  /collapsedTogetherRooms/
);

assert.doesNotMatch(
  card,
  /navigation\.navigate\(['"]Upload['"]/
);

assert.doesNotMatch(
  card,
  /saveAndSchedule/
);

console.log(
  'Together room fold card v2: PASS'
);

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..');
const filename = path.join(
  root,
  'utils/togetherMemberDisplayNameSyncV2.js'
);
const transformed = babel.transformSync(
  fs.readFileSync(filename, 'utf8'),
  {
    filename,
    presets: [
      ['babel-preset-expo', {
        jsxRuntime: 'automatic',
      }],
    ],
    babelrc: false,
    configFile: false,
  }
).code;

let updates = 0;
const moduleRef = { exports: {} };

new Function(
  'module',
  'exports',
  'require',
  transformed
)(
  moduleRef,
  moduleRef.exports,
  (name) => {
    if (name === './togetherRemoteV2') {
      return {
        updateTogetherMemberDisplayNameV2:
          async ({ roomId, displayName }) => {
            assert.equal(roomId, 'room-a');
            assert.equal(displayName, '새 이름');
            updates += 1;
            return true;
          },
      };
    }

    if (name === './togetherProfile') {
      return {
        loadTogetherDisplayName:
          async () => '새 이름',
      };
    }

    return require(name);
  }
);

const {
  syncTogetherMemberDisplayNameV2,
} = moduleRef.exports;

(async () => {
  assert.equal(
    await syncTogetherMemberDisplayNameV2({
      roomId: 'room-a',
    }),
    true
  );

  assert.equal(
    await syncTogetherMemberDisplayNameV2({
      roomId: 'room-a',
    }),
    false
  );

  assert.equal(updates, 1);

  await assert.rejects(
    () => syncTogetherMemberDisplayNameV2({}),
    /TOGETHER_ROOM_REQUIRED/
  );

  const card = fs.readFileSync(
    path.join(
      root,
      'components/TogetherRoomFoldCardV2.js'
    ),
    'utf8'
  );
  const home = fs.readFileSync(
    path.join(
      root,
      'screens/TogetherScreen.js'
    ),
    'utf8'
  );
  const detail = fs.readFileSync(
    path.join(
      root,
      'screens/TogetherRoomDetailScreen.js'
    ),
    'utf8'
  );
  const manage = fs.readFileSync(
    path.join(
      root,
      'screens/TogetherRoomManageScreen.js'
    ),
    'utf8'
  );
  const overview = fs.readFileSync(
    path.join(
      root,
      'components/TogetherRoomOverviewV3.js'
    ),
    'utf8'
  );
  const overviewData = fs.readFileSync(
    path.join(
      root,
      'utils/togetherRoomOverviewV3.js'
    ),
    'utf8'
  );
  const migration = fs.readFileSync(
    path.join(
      root,
      'supabase/migrations/035_together_member_display_name_sync.sql'
    ),
    'utf8'
  );

  assert.match(card, /초대 수락 대기 중/);
  assert.match(home, />함께 PUSH<\/Text>/);
  assert.match(card, /headerMeta/);
  assert.match(card, /textAlign:\s*'left'/);
  assert.match(card, /textAlign:\s*'right'/);
  assert.match(detail, /syncTogetherMemberDisplayNameV2/);
  assert.match(manage, /syncTogetherMemberDisplayNameV2/);
  assert.match(detail, /backgroundColor:\s*primitive\.white/);
  assert.match(detail, /borderColor:\s*primitive\.black/);
  assert.match(detail, /TogetherRoomOverviewV3/);
  assert.match(overviewData, /member\.displayName/);
  assert.match(overview, /member\.name/);
  assert.match(manage, /member\.displayName/);
  assert.match(
    migration,
    /user_id\s*=\s*auth\.uid\(\)/
  );
  assert.match(
    migration,
    /display_name\s+is\s+distinct\s+from/
  );

  console.log(
    'Together member display name sync v2: PASS'
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

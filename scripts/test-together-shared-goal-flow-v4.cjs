const assert = require('node:assert/strict');
const fs = require('node:fs');
const babel = require('@babel/core');
const read = (file) => fs.readFileSync(file, 'utf8');
const compile = (file) => assert.ok(babel.transformSync(read(file), { filename: file, presets: [['babel-preset-expo', { jsxRuntime: 'automatic' }]], babelrc: false, configFile: false }));

const home = read('screens/TogetherScreen.js');
const create = read('screens/TogetherSharedGoalCreateScreen.js');
const drafts = read('utils/togetherRoomDrafts.js');
const invite = read('screens/TogetherInviteDraftScreen.js');
const accept = read('screens/TogetherInviteAcceptScreen.js');
const detail = read('screens/TogetherRoomDetailScreen.js');
const contribution = read('components/TogetherSharedContributionV4.js');
const overview = read('components/TogetherRoomOverviewV3.js');
const remote = read('utils/togetherRemoteV2.js');
const sql = read('supabase/migrations/039_together_shared_contributions_v4.sql');

for (const file of ['screens/TogetherSharedGoalCreateScreen.js','screens/TogetherInviteDraftScreen.js','screens/TogetherInviteAcceptScreen.js','screens/TogetherRoomDetailScreen.js','components/TogetherSharedContributionV4.js','components/TogetherRoomOverviewV3.js','utils/togetherRoomDrafts.js','utils/togetherRemoteV2.js']) compile(file);
assert.match(home, /mode === 'shared_goal'[\s\S]*TogetherSharedGoalCreate/);
assert.doesNotMatch(create, /selectedCard/);
assert.match(create, /source: 'room_contributions_v1'/);
assert.match(create, /useState\('회'\)/);
assert.ok(create.indexOf("value: 'custom'") < create.indexOf("value: '회'"));
assert.match(drafts, /challengeId: newShared \? ''/);
assert.match(invite, /newShared \? \[\] : await loadTogetherEligibleCards/);
assert.match(invite, /initializeTogetherSharedActivityV4/);
assert.match(accept, /sharedInitFailed/);
assert.match(accept, /참여 준비 다시 시도/);
assert.match(detail, /TogetherSharedContributionV4/);
assert.match(detail, /!isNewShared/);
assert.match(overview, /sharedSummary/);
assert.match(contribution, /uuid\.v4\(\)/);
assert.match(contribution, /addTogetherSharedContributionV4/);
assert.match(contribution, /deleteTogetherSharedContributionV4/);
for (const name of ['initialize_together_shared_activity_v4','add_together_shared_contribution_v4','delete_together_shared_contribution_v4','get_together_shared_summary_v4']) {
  assert.ok(remote.includes(name)); assert.ok(sql.includes(name));
}
assert.match(sql, /unique \(room_id, user_id, request_id\)/i);
assert.match(sql, /c\.user_id=v_uid/);
const summarySqlTextV4 =
  require('node:fs').readFileSync(
    'supabase/migrations/039_together_shared_contributions_v4.sql',
    'utf8'
  );
const summaryFunctionV4 =
  summarySqlTextV4.match(
    /create\s+or\s+replace\s+function\s+public\.get_together_shared_summary_v4\s*\(\s*p_room_id\s+uuid\s*\)[\s\S]*?\$\$;/i
  )?.[0];
assert.ok(
  summaryFunctionV4,
  'Shared summary RPC must exist'
);
assert.match(
  summaryFunctionV4,
  /v_viewer_joined_date\s*:=\s*\(\s*v_viewer_joined_at\s+at\s+time\s+zone\s+v_timezone\s*\)\s*::date/i
);
assert.match(
  summaryFunctionV4,
  /and\s+c\.created_at\s*>=\s*m\.joined_at\b/i
);
assert.match(
  summaryFunctionV4,
  /m\.user_id\s*=\s*v_uid[\s\S]*?\bor\s*\(/i
);
assert.match(
  summaryFunctionV4,
  /\(\s*c\.created_at\s+at\s+time\s+zone\s+v_timezone\s*\)\s*::date\s*>\s*v_viewer_joined_date/i
);
assert.match(
  summaryFunctionV4,
  /and\s+c\.created_at\s*>=\s*v_viewer_joined_at\b/i
);
assert.match(
  summaryFunctionV4,
  /and\s+m\.status\s*=\s*'active'/i
);
assert.match(sql, /revoke all on public\.together_shared_contributions_v4 from public, anon, authenticated/i);
assert.doesNotMatch(contribution, /AsyncStorage|challengeId|photo|memo/);
console.log('Together independent shared goal flow v4: PASS');

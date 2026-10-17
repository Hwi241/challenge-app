const assert = require('node:assert/strict');
const fs = require('node:fs');

const sql = fs.readFileSync(
  'supabase/migrations/041_together_week_status_complete_v4.sql',
  'utf8'
);

const screen = fs.readFileSync(
  'components/TogetherRoomWeeklyV3.js',
  'utf8'
);

assert.match(
  sql,
  /create or replace function\s+public\.get_together_week_v3/i
);

assert.match(
  sql,
  /generate_series\s*\(/i
);

assert.match(
  sql,
  /left join public\.together_member_daily_v3/i
);

assert.match(
  sql,
  /coalesce\s*\(\s*d\.status\s*,\s*'pending'\s*\)/i
);

assert.match(
  sql,
  /m\.joined_at/i
);

assert.match(
  sql,
  /v_viewer_joined_date/i
);

assert.match(
  sql,
  /days\.local_date\s*<=\s*v_viewer_joined_date/i
);

assert.match(
  sql,
  /v_goal_start/i
);

assert.match(
  sql,
  /v_goal_end/i
);

assert.match(
  sql,
  /when\s+days\.local_date[\s\S]*?then\s+'off'/i
);

assert.match(
  sql,
  /security definer/i
);

assert.match(
  sql,
  /set search_path\s*=\s*''/i
);

assert.match(
  sql,
  /grant execute on function/i
);

assert.match(
  screen,
  /requestTogetherImmediateSyncV2/
);

assert.match(
  screen,
  /기록 확인 실패/
);

console.log(
  'Together complete weekly status v4: PASS'
);

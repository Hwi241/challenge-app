const assert = require('node:assert/strict');
const fs = require('node:fs');
const sql = fs.readFileSync(
  'supabase/migrations/040_together_shared_rowtype_runtime_fix_v5.sql',
  'utf8'
);
assert.match(
  sql,
  /create or replace function\s+public\.rebuild_together_shared_week_v4/i
);
assert.match(
  sql,
  /create or replace function\s+public\.add_together_shared_contribution_v4/i
);
assert.doesNotMatch(
  sql,
  /\bselect\s+r\s+into\s+v_room\b/i
);
assert.doesNotMatch(
  sql,
  /v_room\s*:=\s*v_lookup\.room_record/i
);
assert.match(
  sql,
  /r\.timezone/i
);
assert.match(
  sql,
  /m\.joined_at/i
);
assert.match(
  sql,
  /v_start_date/i
);
assert.match(
  sql,
  /v_end_date/i
);
assert.match(
  sql,
  /room_contributions_v1/
);
assert.match(
  sql,
  /TOGETHER_ROOM_ACCESS_DENIED/
);
assert.match(
  sql,
  /TOGETHER_CONTRIBUTION_INVALID/
);
assert.match(
  sql,
  /TOGETHER_REQUEST_CONFLICT/
);
assert.match(
  sql,
  /rebuild_together_shared_week_v4\s*\(\s*p_room_id,\s*v_uid\s*\)/i
);
assert.match(
  sql,
  /together_member_daily_v3/
);
assert.match(
  sql,
  /together_shared_contributions_v4/
);
assert.match(
  sql,
  /security definer/ig
);
assert.match(
  sql,
  /set search_path\s*=\s*''/i
);
assert.match(
  sql,
  /revoke all on function/i
);
assert.match(
  sql,
  /grant execute on function/i
);
console.log(
  'Together shared rowtype runtime fix: PASS'
);

const assert = require('node:assert/strict');
const fs = require('node:fs');
const sql = fs.readFileSync(
  'supabase/migrations/039_together_shared_contributions_v4.sql',
  'utf8'
);
assert.match(sql, /validate_together_shared_goal_dates_v4/);
assert.match(sql, /together_shared_goal_dates_guard_v4/);
assert.match(sql, /before insert or update of mode, shared_goal/i);
assert.match(sql, /TOGETHER_SHARED_START_DATE_INVALID/);
assert.match(sql, /TOGETHER_SHARED_END_DATE_INVALID/);
assert.match(sql, /TOGETHER_SHARED_DATE_ORDER_INVALID/);
assert.match(sql, /YYYY-MM-DD/);
assert.match(sql, /initialize_approved_shared_member_v4/);
assert.match(sql, /together_shared_member_activation_v4/);
assert.match(sql, /after insert or update of status, joined_at/i);
assert.match(sql, /rebuild_together_shared_week_v4/);
assert.match(sql, /room_contributions_v1/);
assert.match(sql, /security definer/i);
assert.match(sql, /set search_path\s*=\s*''/i);
assert.match(sql, /revoke all on function/i);
assert.doesNotMatch(
  sql,
  /\binto\s+v_room\s*,\s*v_joined\b/i
);
assert.match(
  sql,
  /\binto\s+v_lookup\b/i
);
assert.match(
  sql,
  /v_room\s*:=\s*v_lookup\.room_record\s*;/i
);
assert.match(
  sql,
  /v_joined\s*:=\s*v_lookup\.joined_at\s*;/i
);
const summaryStart = sql.indexOf(
  'public.get_together_shared_summary_v4('
);
assert.ok(
  summaryStart >= 0,
  'shared summary function missing'
);
const summarySource = sql.slice(
  summaryStart
);
assert.match(
  summarySource,
  /v_total/
);
assert.match(
  summarySource,
  /v_members/
);
assert.match(
  summarySource,
  /v_mine/
);
assert.match(
  summarySource,
  /v_viewer_joined_date/
);
assert.match(
  summarySource,
  /room_contributions_v1/
);
assert.match(
  summarySource,
  /TOGETHER_ROOM_ACCESS_DENIED/
);
assert.match(
  summarySource,
  /'total',\s*v_total/
);
assert.match(
  summarySource,
  /'members',\s*v_members/
);
assert.match(
  summarySource,
  /'mine',\s*v_mine/
);
assert.match(
  summarySource,
  /limit\s+20/i
);
console.log('Together shared goal server guards: PASS');

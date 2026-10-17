const assert = require('node:assert/strict');
const fs = require('node:fs');

const sql = fs.readFileSync(
  'supabase/migrations/042_together_calendar_week_v5.sql',
  'utf8'
);

assert.match(
  sql,
  /create or replace function\s+public\.get_together_week_v3/i
);
assert.match(sql, /extract\(dow from v_anchor\)/i);
assert.match(sql, /v_end\s*:=\s*v_start\s*\+\s*6/i);
assert.match(sql, /generate_series\s*\(/i);
assert.match(sql, /days\.local_date\s*>\s*v_today/i);
assert.match(sql, /left join public\.together_member_daily_v3/i);
assert.match(sql, /coalesce\s*\(\s*d\.status\s*,\s*'pending'\s*\)/i);
assert.match(sql, /m\.joined_at/i);
assert.match(sql, /days\.local_date\s*<=\s*v_viewer_joined_date/i);
assert.match(sql, /v_goal_start/i);
assert.match(sql, /v_goal_end/i);
assert.match(sql, /security definer/i);
assert.match(sql, /set search_path\s*=\s*''/i);
assert.match(sql, /grant execute on function/i);
assert.doesNotMatch(sql, /drop table|truncate table/i);

console.log('Together calendar week v5: PASS');

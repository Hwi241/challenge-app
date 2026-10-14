begin;
-- 1. 공동 PUSH 최근 7일 활동 재계산
-- 기존 ROWTYPE 복합 행 대입 제거
create or replace function
public.rebuild_together_shared_week_v4(
  p_room_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timezone text;
  v_start_date date;
  v_end_date date;
  v_joined timestamptz;
  v_today date;
  v_first date;
begin
  select
    r.timezone,
    (r.shared_goal ->> 'startsAt')::date,
    nullif(
      r.shared_goal ->> 'endsAt',
      ''
    )::date,
    m.joined_at
  into
    v_timezone,
    v_start_date,
    v_end_date,
    v_joined
  from public.together_rooms r
  join public.together_room_members m
    on m.room_id = r.id
  where r.id = p_room_id
    and m.user_id = p_user_id
    and m.status = 'active'
    and r.status = 'active'
    and r.mode = 'shared_goal'
    and r.shared_goal ->> 'source'
      = 'room_contributions_v1';
  if not found then
    raise exception
      'TOGETHER_ROOM_ACCESS_DENIED';
  end if;
  v_today :=
    (now() at time zone v_timezone)::date;
  v_first := greatest(
    v_today - 6,
    (v_joined at time zone v_timezone)::date
  );
  delete from public.together_member_daily_v3
  where room_id = p_room_id
    and user_id = p_user_id
    and local_date between v_first and v_today;
  insert into public.together_member_daily_v3 (
    room_id,
    user_id,
    local_date,
    status
  )
  select
    p_room_id,
    p_user_id,
    d::date,
    case
      when d::date < v_start_date
        or (
          v_end_date is not null
          and d::date > v_end_date
        )
      then 'off'
      when exists (
        select 1
        from public.together_shared_contributions_v4 c
        where c.room_id = p_room_id
          and c.user_id = p_user_id
          and (
            c.created_at at time zone v_timezone
          )::date = d::date
      )
      then 'done'
      else 'pending'
    end
  from generate_series(
    v_first,
    v_today,
    interval '1 day'
  ) d;
end;
$$;
-- 2. 공동 PUSH 기여 추가
-- 기존 ROWTYPE 방 조회 제거
create or replace function
public.add_together_shared_contribution_v4(
  p_room_id uuid,
  p_amount numeric,
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_timezone text;
  v_end_date date;
  v_existing
    public.together_shared_contributions_v4%rowtype;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'TOGETHER_AUTH_REQUIRED';
  end if;
  if p_request_id is null
    or p_amount is null
    or p_amount <= 0
    or p_amount > 1000000000000
    or scale(p_amount) > 3
  then
    raise exception
      'TOGETHER_CONTRIBUTION_INVALID';
  end if;
  select
    r.timezone,
    nullif(
      r.shared_goal ->> 'endsAt',
      ''
    )::date
  into
    v_timezone,
    v_end_date
  from public.together_rooms r
  join public.together_room_members m
    on m.room_id = r.id
  where r.id = p_room_id
    and r.status = 'active'
    and r.mode = 'shared_goal'
    and r.shared_goal ->> 'source'
      = 'room_contributions_v1'
    and m.user_id = v_uid
    and m.status = 'active';
  if not found then
    raise exception
      'TOGETHER_ROOM_ACCESS_DENIED';
  end if;
  if v_end_date is not null
    and (
      now() at time zone v_timezone
    )::date > v_end_date
  then
    raise exception
      'TOGETHER_SHARED_GOAL_ENDED';
  end if;
  select *
  into v_existing
  from public.together_shared_contributions_v4
  where room_id = p_room_id
    and user_id = v_uid
    and request_id = p_request_id;
  if found then
    if v_existing.amount
      is distinct from p_amount
    then
      raise exception
        'TOGETHER_REQUEST_CONFLICT';
    end if;
    return v_existing.id;
  end if;
  insert into public.together_shared_contributions_v4 (
    room_id,
    user_id,
    amount,
    request_id
  )
  values (
    p_room_id,
    v_uid,
    p_amount,
    p_request_id
  )
  returning id into v_id;
  perform public.rebuild_together_shared_week_v4(
    p_room_id,
    v_uid
  );
  update public.together_rooms
  set updated_at = now()
  where id = p_room_id;
  return v_id;
end;
$$;
-- 기존 내부 함수 직접 실행 제한 유지
revoke all on function
public.rebuild_together_shared_week_v4(uuid, uuid)
from public, anon, authenticated;
-- 기존 외부 RPC 권한 유지
revoke all on function
public.add_together_shared_contribution_v4(
  uuid, numeric, uuid
)
from public, anon, authenticated;
grant execute on function
public.add_together_shared_contribution_v4(
  uuid, numeric, uuid
)
to authenticated;
commit;

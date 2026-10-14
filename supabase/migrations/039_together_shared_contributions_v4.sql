begin;

create table if not exists public.together_shared_contributions_v4 (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.together_rooms(id) on delete cascade,
  user_id uuid not null,
  amount numeric(20,3) not null check (amount > 0 and amount <= 1000000000000),
  request_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (room_id, user_id) references public.together_room_members(room_id, user_id) on delete cascade,
  unique (room_id, user_id, request_id)
);
create index if not exists together_shared_contributions_v4_room_created_idx on public.together_shared_contributions_v4(room_id, created_at);
create index if not exists together_shared_contributions_v4_room_user_created_idx on public.together_shared_contributions_v4(room_id, user_id, created_at);
alter table public.together_shared_contributions_v4 enable row level security;
revoke all on public.together_shared_contributions_v4 from public, anon, authenticated;

create or replace function public.rebuild_together_shared_week_v4(p_room_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_room public.together_rooms%rowtype; v_joined timestamptz; v_today date; v_first date; v_lookup record;
begin
  select
    r as room_record,
    m.joined_at as joined_at
  into v_lookup
  from public.together_rooms r join public.together_room_members m on m.room_id=r.id
  where r.id=p_room_id and m.user_id=p_user_id and m.status='active' and r.status='active'
    and r.mode='shared_goal' and r.shared_goal->>'source'='room_contributions_v1';
  if not found then raise exception 'TOGETHER_ROOM_ACCESS_DENIED'; end if;
  v_room := v_lookup.room_record;
  v_joined := v_lookup.joined_at;
  v_today := (now() at time zone v_room.timezone)::date;
  v_first := greatest(v_today-6, (v_joined at time zone v_room.timezone)::date);
  delete from public.together_member_daily_v3 where room_id=p_room_id and user_id=p_user_id and local_date between v_first and v_today;
  insert into public.together_member_daily_v3(room_id,user_id,local_date,status)
  select p_room_id,p_user_id,d::date,
    case
      when d::date < coalesce(nullif(v_room.shared_goal->>'startsAt','')::date,d::date)
        or (nullif(v_room.shared_goal->>'endsAt','') is not null and d::date > (v_room.shared_goal->>'endsAt')::date) then 'off'
      when exists(select 1 from public.together_shared_contributions_v4 c where c.room_id=p_room_id and c.user_id=p_user_id and (c.created_at at time zone v_room.timezone)::date=d::date) then 'done'
      else 'pending'
    end
  from generate_series(v_first,v_today,interval '1 day') d;
end;
$$;

create or replace function public.initialize_together_shared_activity_v4(p_room_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'TOGETHER_AUTH_REQUIRED'; end if;
  perform public.rebuild_together_shared_week_v4(p_room_id,v_uid);
  update public.together_rooms set updated_at=now() where id=p_room_id;
end;
$$;

create or replace function public.add_together_shared_contribution_v4(p_room_id uuid,p_amount numeric,p_request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_room public.together_rooms%rowtype; v_existing public.together_shared_contributions_v4%rowtype; v_id uuid;
begin
  if v_uid is null then raise exception 'TOGETHER_AUTH_REQUIRED'; end if;
  if p_request_id is null or p_amount is null or p_amount<=0 or p_amount>1000000000000 or scale(p_amount)>3 then raise exception 'TOGETHER_CONTRIBUTION_INVALID'; end if;
  select r into v_room from public.together_rooms r join public.together_room_members m on m.room_id=r.id
  where r.id=p_room_id and r.status='active' and r.mode='shared_goal' and r.shared_goal->>'source'='room_contributions_v1'
    and m.user_id=v_uid and m.status='active';
  if not found then raise exception 'TOGETHER_ROOM_ACCESS_DENIED'; end if;
  if nullif(v_room.shared_goal->>'endsAt','') is not null and (now() at time zone v_room.timezone)::date > (v_room.shared_goal->>'endsAt')::date then raise exception 'TOGETHER_SHARED_GOAL_ENDED'; end if;
  select * into v_existing from public.together_shared_contributions_v4 where room_id=p_room_id and user_id=v_uid and request_id=p_request_id;
  if found then
    if v_existing.amount is distinct from p_amount then raise exception 'TOGETHER_REQUEST_CONFLICT'; end if;
    return v_existing.id;
  end if;
  insert into public.together_shared_contributions_v4(room_id,user_id,amount,request_id) values(p_room_id,v_uid,p_amount,p_request_id) returning id into v_id;
  perform public.rebuild_together_shared_week_v4(p_room_id,v_uid);
  update public.together_rooms set updated_at=now() where id=p_room_id;
  return v_id;
end;
$$;

create or replace function public.delete_together_shared_contribution_v4(p_contribution_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_room_id uuid;
begin
  if v_uid is null then raise exception 'TOGETHER_AUTH_REQUIRED'; end if;
  select c.room_id into v_room_id from public.together_shared_contributions_v4 c
  join public.together_room_members m on m.room_id=c.room_id and m.user_id=v_uid and m.status='active'
  where c.id=p_contribution_id and c.user_id=v_uid;
  if not found then raise exception 'TOGETHER_CONTRIBUTION_ACCESS_DENIED'; end if;
  delete from public.together_shared_contributions_v4 where id=p_contribution_id and user_id=v_uid;
  perform public.rebuild_together_shared_week_v4(v_room_id,v_uid);
  update public.together_rooms set updated_at=now() where id=v_room_id;
end;
$$;

create or replace function
public.get_together_shared_summary_v4(
  p_room_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_timezone text;
  v_viewer_joined_at timestamptz;
  v_viewer_joined_date date;
  v_total numeric := 0;
  v_members jsonb := '[]'::jsonb;
  v_mine jsonb := '[]'::jsonb;
begin
  -- 1. 인증 확인
  if v_uid is null then
    raise exception 'TOGETHER_AUTH_REQUIRED';
  end if;
  -- 2. 활성 공동 PUSH 멤버인지 확인
  select
    r.timezone,
    m.joined_at
  into
    v_timezone,
    v_viewer_joined_at
  from public.together_room_members m
  join public.together_rooms r
    on r.id = m.room_id
  where m.room_id = p_room_id
    and m.user_id = v_uid
    and m.status = 'active'
    and r.status = 'active'
    and r.mode = 'shared_goal'
    and r.shared_goal ->> 'source'
      = 'room_contributions_v1';
  if not found then
    raise exception 'TOGETHER_ROOM_ACCESS_DENIED';
  end if;
  v_viewer_joined_date :=
    (
      v_viewer_joined_at
      at time zone v_timezone
    )::date;
  -- 3. 공동 PUSH 전체 누적 기여량
  -- 방 전체의 기록을 합산한다.
  -- 개인 PUSH 기록은 참조하지 않는다.
  select
    coalesce(sum(c.amount), 0)
  into
    v_total
  from public.together_shared_contributions_v4 c
  where c.room_id = p_room_id;
  -- 4. 활성 멤버별 공개 가능 기여량
  -- 타인의 가입 전 및 가입 당일 기여는
  -- 조회자에게 공개하지 않는다.
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'userId', x.user_id,
          'amount', x.amount
        )
        order by
          x.role_order,
          x.joined_at,
          x.user_id
      ),
      '[]'::jsonb
    )
  into
    v_members
  from (
    select
      m.user_id,
      m.joined_at,
      case m.role
        when 'owner' then 0
        when 'admin' then 1
        else 2
      end as role_order,
      coalesce(
        (
          select
            sum(c.amount)
          from public.together_shared_contributions_v4 c
          where c.room_id = m.room_id
            and c.user_id = m.user_id
            -- 해당 멤버의 현재 가입 이후 기록
            and c.created_at >= m.joined_at
            and (
              -- 본인은 현재 가입 이후 기록 확인
              m.user_id = v_uid
              -- 타인은 조회자의 가입 다음 날부터 공개
              or (
                (
                  c.created_at
                  at time zone v_timezone
                )::date > v_viewer_joined_date
              )
            )
        ),
        0
      ) as amount
    from public.together_room_members m
    where m.room_id = p_room_id
      and m.status = 'active'
  ) x;
  -- 5. 본인의 최근 기여 20개
  -- 타인의 개별 기록은 반환하지 않는다.
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', x.id,
          'amount', x.amount,
          'createdAt', x.created_at
        )
        order by
          x.created_at desc,
          x.id desc
      ),
      '[]'::jsonb
    )
  into
    v_mine
  from (
    select
      c.id,
      c.amount,
      c.created_at
    from public.together_shared_contributions_v4 c
    where c.room_id = p_room_id
      and c.user_id = v_uid
      and c.created_at >= v_viewer_joined_at
    order by
      c.created_at desc,
      c.id desc
    limit 20
  ) x;
  -- 6. 결과 반환
  return jsonb_build_object(
    'total', v_total,
    'members', v_members,
    'mine', v_mine
  );
end;
$$;
revoke all on function
  public.get_together_shared_summary_v4(uuid)
from public, anon, authenticated;
grant execute on function
  public.get_together_shared_summary_v4(uuid)
to authenticated;

revoke all on function public.rebuild_together_shared_week_v4(uuid,uuid) from public,anon,authenticated;
revoke all on function public.initialize_together_shared_activity_v4(uuid),public.add_together_shared_contribution_v4(uuid,numeric,uuid),public.delete_together_shared_contribution_v4(uuid) from public,anon;
grant execute on function public.initialize_together_shared_activity_v4(uuid),public.add_together_shared_contribution_v4(uuid,numeric,uuid),public.delete_together_shared_contribution_v4(uuid) to authenticated;

create or replace function
public.validate_together_shared_goal_dates_v4()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start_text text;
  v_end_text text;
  v_start date;
  v_end date;
begin
  if new.mode <> 'shared_goal'
    or coalesce(new.shared_goal ->> 'source', '') <> 'room_contributions_v1'
  then
    return new;
  end if;
  if jsonb_typeof(new.shared_goal -> 'startsAt') is distinct from 'string' then
    raise exception 'TOGETHER_SHARED_START_DATE_INVALID';
  end if;
  v_start_text := new.shared_goal ->> 'startsAt';
  if v_start_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'TOGETHER_SHARED_START_DATE_INVALID';
  end if;
  begin
    v_start := v_start_text::date;
  exception when others then
    raise exception 'TOGETHER_SHARED_START_DATE_INVALID';
  end;
  if to_char(v_start, 'YYYY-MM-DD') <> v_start_text then
    raise exception 'TOGETHER_SHARED_START_DATE_INVALID';
  end if;
  if new.shared_goal ? 'endsAt'
    and jsonb_typeof(new.shared_goal -> 'endsAt') not in ('string', 'null')
  then
    raise exception 'TOGETHER_SHARED_END_DATE_INVALID';
  end if;
  v_end_text := new.shared_goal ->> 'endsAt';
  if v_end_text is not null then
    if v_end_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'TOGETHER_SHARED_END_DATE_INVALID';
    end if;
    begin
      v_end := v_end_text::date;
    exception when others then
      raise exception 'TOGETHER_SHARED_END_DATE_INVALID';
    end;
    if to_char(v_end, 'YYYY-MM-DD') <> v_end_text then
      raise exception 'TOGETHER_SHARED_END_DATE_INVALID';
    end if;
    if v_end < v_start then
      raise exception 'TOGETHER_SHARED_DATE_ORDER_INVALID';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists together_shared_goal_dates_guard_v4 on public.together_rooms;
create trigger together_shared_goal_dates_guard_v4
before insert or update of mode, shared_goal
on public.together_rooms
for each row
execute function public.validate_together_shared_goal_dates_v4();
revoke all on function public.validate_together_shared_goal_dates_v4() from public, anon, authenticated;

create or replace function
public.initialize_approved_shared_member_v4()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'active' then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.status = 'active'
      and old.joined_at is not distinct from new.joined_at
    then
      return new;
    end if;
  end if;
  if not exists (
    select 1
    from public.together_rooms r
    where r.id = new.room_id
      and r.status = 'active'
      and r.mode = 'shared_goal'
      and r.shared_goal ->> 'source' = 'room_contributions_v1'
  ) then
    return new;
  end if;
  perform public.rebuild_together_shared_week_v4(new.room_id, new.user_id);
  update public.together_rooms set updated_at = now() where id = new.room_id;
  return new;
end;
$$;

drop trigger if exists together_shared_member_activation_v4 on public.together_room_members;
create trigger together_shared_member_activation_v4
after insert or update of status, joined_at
on public.together_room_members
for each row
execute function public.initialize_approved_shared_member_v4();
revoke all on function public.initialize_approved_shared_member_v4() from public, anon, authenticated;

commit;

begin;

create table if not exists
public.together_member_daily_v3 (
  room_id uuid not null,
  user_id uuid not null,
  local_date date not null,
  status text not null
    check (status in ('done', 'pending', 'off')),
  updated_at timestamptz not null default now(),

  primary key (room_id, user_id, local_date),

  foreign key (room_id, user_id)
    references public.together_room_members(room_id, user_id)
    on delete cascade
);

create index if not exists
together_member_daily_v3_room_date_idx
on public.together_member_daily_v3 (
  room_id,
  local_date,
  user_id
);

alter table public.together_member_daily_v3
enable row level security;

revoke all on public.together_member_daily_v3
from public, anon, authenticated;

create or replace function
public.replace_together_member_week_v3(
  p_room_id uuid,
  p_days jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_timezone text;
  v_joined_at timestamptz;
  v_today date;
  v_first date;
  v_item jsonb;
  v_date date;
  v_status text;
  v_seen date[] := array[]::date[];
begin
  if v_uid is null then
    raise exception 'TOGETHER_AUTH_REQUIRED';
  end if;

  select
    r.timezone,
    m.joined_at
  into
    v_timezone,
    v_joined_at
  from public.together_room_members m
  join public.together_rooms r
    on r.id = m.room_id
  where m.room_id = p_room_id
    and m.user_id = v_uid
    and m.status = 'active'
    and r.status = 'active';

  if not found then
    raise exception 'TOGETHER_ROOM_ACCESS_DENIED';
  end if;

  if p_days is null
    or jsonb_typeof(p_days) <> 'array'
    or jsonb_array_length(p_days) > 7
  then
    raise exception 'TOGETHER_WEEK_INVALID';
  end if;

  v_today :=
    (now() at time zone v_timezone)::date;

  v_first := greatest(
    v_today - 6,
    (v_joined_at at time zone v_timezone)::date
  );

  for v_item in
    select value
    from jsonb_array_elements(p_days)
  loop
    if jsonb_typeof(v_item) <> 'object'
      or not (v_item ? 'localDate')
      or not (v_item ? 'status')
      or (
        v_item - 'localDate' - 'status'
      ) <> '{}'::jsonb
    then
      raise exception 'TOGETHER_DAY_INVALID';
    end if;

    if jsonb_typeof(v_item -> 'localDate') <> 'string'
      or jsonb_typeof(v_item -> 'status') <> 'string'
    then
      raise exception 'TOGETHER_DAY_INVALID';
    end if;

    if (v_item ->> 'localDate')
      !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    then
      raise exception 'TOGETHER_DAY_DATE_INVALID';
    end if;

    v_status := v_item ->> 'status';

    if v_status not in (
      'done',
      'pending',
      'off'
    ) then
      raise exception 'TOGETHER_DAY_STATUS_INVALID';
    end if;

    begin
      v_date := (v_item ->> 'localDate')::date;
    exception
      when others then
        raise exception 'TOGETHER_DAY_DATE_INVALID';
    end;

    if v_date < v_first
      or v_date > v_today
      or v_date = any(v_seen)
    then
      raise exception 'TOGETHER_DAY_RANGE_INVALID';
    end if;

    v_seen := array_append(v_seen, v_date);
  end loop;

  delete from public.together_member_daily_v3
  where room_id = p_room_id
    and user_id = v_uid
    and local_date between v_first and v_today;

  for v_item in
    select value
    from jsonb_array_elements(p_days)
  loop
    insert into public.together_member_daily_v3 (
      room_id,
      user_id,
      local_date,
      status
    )
    values (
      p_room_id,
      v_uid,
      (v_item ->> 'localDate')::date,
      v_item ->> 'status'
    );
  end loop;
end;
$$;

create or replace function
public.get_together_week_v3(
  p_room_id uuid,
  p_start_date date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_timezone text;
  v_viewer_joined_at timestamptz;
  v_today date;
  v_start date;
  v_end date;
  v_members jsonb;
  v_count integer;
begin
  select r.timezone, me.joined_at
  into v_timezone, v_viewer_joined_at
  from public.together_room_members me
  join public.together_rooms r
    on r.id = me.room_id
  where me.room_id = p_room_id
    and me.user_id = auth.uid()
    and me.status = 'active'
    and r.status = 'active';

  if not found then
    raise exception 'TOGETHER_ROOM_ACCESS_DENIED';
  end if;

  v_today :=
    (now() at time zone v_timezone)::date;

  v_start := greatest(
    coalesce(p_start_date, v_today - 6),
    (v_viewer_joined_at at time zone v_timezone)::date
  );

  if v_start > v_today then
    raise exception 'TOGETHER_WEEK_FUTURE_INVALID';
  end if;

  v_end := least(v_start + 6, v_today);

  select count(*)
  into v_count
  from public.together_room_members
  where room_id = p_room_id
    and status = 'active';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'userId', m.user_id,
        'days', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'localDate', d.local_date,
                'status', d.status
              )
              order by d.local_date
            )
            from public.together_member_daily_v3 d
            where d.room_id = p_room_id
              and d.user_id = m.user_id
              and d.local_date between v_start and v_end
              and d.local_date >=
                (m.joined_at at time zone v_timezone)::date
              and (
                m.user_id = auth.uid()
                or d.local_date >
                  (v_viewer_joined_at at time zone v_timezone)::date
              )
          ),
          '[]'::jsonb
        )
      )
      order by
        m.role_order,
        m.joined_at,
        m.user_id
    ),
    '[]'::jsonb
  )
  into v_members
  from (
    select
      user_id,
      joined_at,
      case role
        when 'owner' then 0
        when 'admin' then 1
        else 2
      end as role_order
    from public.together_room_members
    where room_id = p_room_id
      and status = 'active'
    order by
      role_order,
      joined_at,
      user_id
    limit 8
  ) m;

  return jsonb_build_object(
    'startDate', v_start,
    'endDate', v_end,
    'memberCount', v_count,
    'limitedTo', 8,
    'members', v_members
  );
end;
$$;

revoke all on function
public.replace_together_member_week_v3(uuid, jsonb)
from public, anon;

revoke all on function
public.get_together_week_v3(uuid, date)
from public, anon;

grant execute on function
public.replace_together_member_week_v3(uuid, jsonb)
to authenticated;

grant execute on function
public.get_together_week_v3(uuid, date)
to authenticated;

commit;

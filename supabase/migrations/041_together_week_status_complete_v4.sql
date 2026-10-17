begin;

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
  v_uid uuid := auth.uid();
  v_timezone text;
  v_viewer_joined_at timestamptz;
  v_viewer_joined_date date;
  v_goal_start date;
  v_goal_end date;
  v_today date;
  v_start date;
  v_end date;
  v_members jsonb;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'TOGETHER_AUTH_REQUIRED';
  end if;

  select
    r.timezone,
    me.joined_at,
    case
      when r.mode = 'shared_goal'
        and r.shared_goal ->> 'source'
          = 'room_contributions_v1'
      then (r.shared_goal ->> 'startsAt')::date
      else null
    end,
    case
      when r.mode = 'shared_goal'
        and r.shared_goal ->> 'source'
          = 'room_contributions_v1'
      then nullif(
        r.shared_goal ->> 'endsAt',
        ''
      )::date
      else null
    end
  into
    v_timezone,
    v_viewer_joined_at,
    v_goal_start,
    v_goal_end
  from public.together_room_members me
  join public.together_rooms r
    on r.id = me.room_id
  where me.room_id = p_room_id
    and me.user_id = v_uid
    and me.status = 'active'
    and r.status = 'active';

  if not found then
    raise exception 'TOGETHER_ROOM_ACCESS_DENIED';
  end if;

  v_today :=
    (now() at time zone v_timezone)::date;

  v_viewer_joined_date :=
    (
      v_viewer_joined_at
      at time zone v_timezone
    )::date;

  v_start := greatest(
    coalesce(p_start_date, v_today - 6),
    v_viewer_joined_date
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

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'userId', m.user_id,
          'days',
          (
            select
              coalesce(
                jsonb_agg(
                  jsonb_build_object(
                    'localDate', days.local_date,
                    'status',
                    case
                      -- 해당 멤버가 아직 참여하지 않은 날짜
                      when days.local_date <
                        (
                          m.joined_at
                          at time zone v_timezone
                        )::date
                      then 'off'

                      -- 조회자의 가입일 이전 및 당일
                      -- 다른 멤버의 활동은 공개하지 않음
                      when m.user_id <> v_uid
                        and days.local_date
                          <= v_viewer_joined_date
                      then 'off'

                      -- 독립 공동 목표의 시작 전
                      when v_goal_start is not null
                        and days.local_date < v_goal_start
                      then 'off'

                      -- 독립 공동 목표의 종료 후
                      when v_goal_end is not null
                        and days.local_date > v_goal_end
                      then 'off'

                      -- 실제 서버 기록 우선
                      -- 없는 활동 대상 날짜는 미기록
                      else coalesce(
                        d.status,
                        'pending'
                      )
                    end
                  )
                  order by days.local_date
                ),
                '[]'::jsonb
              )
            from (
              select
                gs.day::date as local_date
              from generate_series(
                v_start,
                v_end,
                interval '1 day'
              ) as gs(day)
            ) days
            left join public.together_member_daily_v3 d
              on d.room_id = p_room_id
              and d.user_id = m.user_id
              and d.local_date = days.local_date
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
public.get_together_week_v3(uuid, date)
from public, anon;

grant execute on function
public.get_together_week_v3(uuid, date)
to authenticated;

commit;

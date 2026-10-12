begin;

create table if not exists public.together_user_nicknames (
  user_id uuid primary key
    references auth.users(id) on delete cascade,
  nickname text,
  updated_at timestamptz not null default now(),
  constraint together_user_nickname_length_check
    check (
      nickname is null
      or (
        nickname = btrim(nickname)
        and char_length(nickname) between 1 and 40
      )
    )
);

create unique index if not exists together_user_nickname_key_uidx
on public.together_user_nicknames (lower(nickname))
where nickname is not null;

alter table public.together_user_nicknames
enable row level security;

revoke all on public.together_user_nicknames
from public, anon, authenticated;

create or replace function public.get_my_together_nickname_v2()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select n.nickname
      from public.together_user_nicknames n
      where n.user_id = auth.uid()
    ),
    ''
  );
$$;

create or replace function public.set_my_together_nickname_v2(
  p_nickname text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := nullif(btrim(coalesce(p_nickname, '')), '');
  v_constraint text;
begin
  if v_uid is null then
    raise exception 'TOGETHER_AUTH_REQUIRED';
  end if;

  if v_name is not null and char_length(v_name) > 40 then
    raise exception 'TOGETHER_NICKNAME_TOO_LONG';
  end if;

  insert into public.together_user_nicknames
    (user_id, nickname, updated_at)
  values
    (v_uid, v_name, now())
  on conflict (user_id) do update
  set nickname = excluded.nickname,
      updated_at = now()
  where public.together_user_nicknames.nickname
        is distinct from excluded.nickname;

  update public.together_room_members
  set display_name = coalesce(v_name, '멤버')
  where user_id = v_uid
    and status = 'active'
    and display_name is distinct from coalesce(v_name, '멤버');

  update public.together_join_requests
  set display_name = coalesce(v_name, '멤버')
  where user_id = v_uid
    and status = 'pending'
    and display_name is distinct from coalesce(v_name, '멤버');

  return coalesce(v_name, '');

exception
  when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;

    if v_constraint = 'together_user_nickname_key_uidx' then
      raise exception 'TOGETHER_NICKNAME_TAKEN';
    end if;

    raise;
end;
$$;

-- 기존 방 생성/참여/진행상태 RPC가 전달하는 임의 이름 차단.
-- 공식 닉네임 등록 전의 기존 membership 값은 보존한다.

create or replace function
public.enforce_together_official_display_name_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name
text;
  v_registered boolean;
begin
  select n.nickname
  into v_name
  from public.together_user_nicknames n
  where n.user_id = new.user_id;

  v_registered := found;

  if v_registered then
    new.display_name := coalesce(v_name, '멤버');
  elsif tg_op = 'INSERT' then
    new.display_name := '멤버';
  elsif new.user_id is distinct from old.user_id then
    new.display_name := '멤버';
  elsif new.display_name is distinct from old.display_name then
    new.display_name := old.display_name;
  end if;

  return new;
end;
$$;

drop trigger if exists
  together_members_official_name_v2
on public.together_room_members;

create trigger together_members_official_name_v2
before insert or update of display_name, user_id
on public.together_room_members
for each row
execute function
public.enforce_together_official_display_name_v2();

drop trigger if exists
  together_join_requests_official_name_v2
on public.together_join_requests;

create trigger together_join_requests_official_name_v2
before insert or update of display_name, user_id
on public.together_join_requests
for each row
execute function
public.enforce_together_official_display_name_v2();

-- 기존 035 RPC의 이름 인자는 호환성을 위해 유지한다.
-- 실제 변경 이름은 클라이언트 값이 아니라 서버 공식 닉네임이다.

create or replace function
public.update_together_member_display_name_v2(
  p_room_id uuid,
  p_display_name text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_registered boolean;
  v_changed_count integer := 0;
begin
  if v_uid is null then
    raise exception 'TOGETHER_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.together_room_members m
    where m.room_id = p_room_id
      and m.user_id = v_uid
      and m.status = 'active'
  ) then
    raise exception 'TOGETHER_ROOM_ACCESS_DENIED';
  end if;

  select n.nickname
  into v_name
  from public.together_user_nicknames n
  where n.user_id = v_uid;

  v_registered := found;

  if not v_registered then
    return false;
  end if;

  update public.together_room_members
  set display_name = coalesce(v_name, '멤버')
  where room_id = p_room_id
    and user_id = v_uid
    and status = 'active'
    and display_name is distinct from coalesce(v_name, '멤버');

  get diagnostics v_changed_count = row_count;

  return v_changed_count > 0;
end;
$$;

revoke all on function
public.get_my_together_nickname_v2()
from public;

revoke all on function
public.set_my_together_nickname_v2(text)
from public;

revoke all on function
public.enforce_together_official_display_name_v2()
from public;

revoke all on function
public.update_together_member_display_name_v2(uuid, text)
from public;

grant execute on function
public.get_my_together_nickname_v2()
to authenticated;

grant execute on function
public.set_my_together_nickname_v2(text)
to authenticated;

grant execute on function
public.update_together_member_display_name_v2(uuid, text)
to authenticated;

commit;

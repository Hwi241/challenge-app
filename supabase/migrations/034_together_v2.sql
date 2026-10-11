begin;

alter table public.together_rooms
  add column if not exists mode text not null default 'paired_push',
  add column if not exists title text not null default '함께 활동',
  add column if not exists timezone text not null default 'Asia/Seoul',
  add column if not exists member_limit integer not null default 2,
  add column if not exists join_policy text not null default 'invite',
  add column if not exists locked boolean not null default false,
  add column if not exists push_template jsonb,
  add column if not exists shared_goal jsonb,
  add column if not exists client_request_id uuid,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists together_rooms_client_request_id_uidx
on public.together_rooms(client_request_id) where client_request_id is not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'together_rooms_mode_check') then
    alter table public.together_rooms add constraint together_rooms_mode_check check (mode in ('watch','same_push','paired_push','shared_goal'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'together_rooms_member_limit_check') then
    alter table public.together_rooms add constraint together_rooms_member_limit_check check (member_limit >= 2 and member_limit <= 100000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'together_rooms_join_policy_check') then
    alter table public.together_rooms add constraint together_rooms_join_policy_check check (join_policy in ('invite','approval','closed','public'));
  end if;
end $$;

alter table public.together_room_members drop constraint if exists together_room_members_room_id_role_key;
alter table public.together_room_members drop constraint if exists together_room_members_role_check;
update public.together_room_members set role = 'member' where role = 'partner';
alter table public.together_room_members
  add column if not exists display_name text not null default '멤버',
  add column if not exists status text not null default 'active',
  add column if not exists joined_at timestamptz not null default now(),
  add column if not exists left_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'together_room_members_role_v2_check') then
    alter table public.together_room_members add constraint together_room_members_role_v2_check check (role in ('owner','admin','member'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'together_room_members_status_check') then
    alter table public.together_room_members add constraint together_room_members_status_check check (status in ('active','left','kicked'));
  end if;
end $$;

create table if not exists public.together_invites (
  id uuid primary key default gen_random_uuid(), room_id uuid not null references public.together_rooms(id) on delete cascade,
  code text not null unique, created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'), max_uses integer,
  used_count integer not null default 0, revoked_at timestamptz, created_at timestamptz not null default now(),
  constraint together_invites_max_uses_check check (max_uses is null or max_uses >= 1),
  constraint together_invites_used_count_check check (used_count >= 0)
);
create index if not exists together_invites_room_idx on public.together_invites(room_id);

create table if not exists public.together_member_states (
  room_id uuid not null, user_id uuid not null, local_date date not null,
  completed boolean not null default false, progress numeric, streak integer not null default 0,
  contribution numeric not null default 0, updated_at timestamptz not null default now(),
  primary key (room_id,user_id), foreign key (room_id,user_id) references public.together_room_members(room_id,user_id) on delete cascade,
  check (progress is null or (progress >= 0 and progress <= 1)), check (streak >= 0), check (contribution >= 0)
);
create table if not exists public.together_room_blocks (
  room_id uuid not null references public.together_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  blocked_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (room_id,user_id)
);
create table if not exists public.together_join_requests (
  room_id uuid not null references public.together_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default '멤버', status text not null default 'pending',
  requested_at timestamptz not null default now(), resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null, primary key (room_id,user_id),
  check (status in ('pending','approved','rejected'))
);

alter table public.together_invites enable row level security;
alter table public.together_member_states enable row level security;
alter table public.together_room_blocks enable row level security;
alter table public.together_join_requests enable row level security;

create or replace function public.is_together_room_member(p_room_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.together_room_members m where m.room_id=p_room_id and m.user_id=auth.uid() and m.status='active');
$$;
revoke all on function public.is_together_room_member(uuid) from public;
grant execute on function public.is_together_room_member(uuid) to authenticated;
create or replace function public.is_together_room_admin(target_room_id uuid,target_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.together_room_members m where m.room_id=target_room_id and m.user_id=target_user_id and m.status='active' and m.role in ('owner','admin'));
$$;
revoke all on function public.is_together_room_admin(uuid,uuid) from public;

drop policy if exists together_member_states_select on public.together_member_states;
create policy together_member_states_select on public.together_member_states for select to authenticated using (public.is_together_room_member(room_id));
grant select on public.together_member_states, public.together_rooms, public.together_room_members to authenticated;
revoke insert,update,delete on public.together_member_states from authenticated;
revoke all on public.together_invites, public.together_room_blocks, public.together_join_requests from anon,authenticated;

create or replace function public.create_together_room_v2(p_mode text,p_title text,p_timezone text,p_push_template jsonb,p_shared_goal jsonb,p_client_request_id uuid,p_display_name text)
returns table(room_id uuid,invite_code text,invite_expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_room uuid; v_code text; v_exp timestamptz; v_display text:=left(coalesce(nullif(btrim(p_display_name),''),'멤버'),40);
begin
 if v_uid is null then raise exception 'TOGETHER_AUTH_REQUIRED'; end if;
 if p_client_request_id is null then raise exception 'TOGETHER_REQUEST_ID_REQUIRED'; end if;
 if p_mode not in ('watch','same_push','paired_push','shared_goal') then raise exception 'TOGETHER_MODE_INVALID'; end if;
 if nullif(btrim(coalesce(p_title,'')),'') is null then raise exception 'TOGETHER_TITLE_REQUIRED'; end if;
 if p_mode in ('watch','same_push') and (p_push_template is null or jsonb_typeof(p_push_template)<>'object') then raise exception 'TOGETHER_PUSH_TEMPLATE_REQUIRED'; end if;
 if p_mode='shared_goal' and (p_shared_goal is null or jsonb_typeof(p_shared_goal)<>'object' or coalesce((p_shared_goal->>'target')::numeric,0)<=0 or nullif(btrim(p_shared_goal->>'unit'),'') is null) then raise exception 'TOGETHER_SHARED_GOAL_INVALID'; end if;
 select r.id into v_room from public.together_rooms r where r.client_request_id=p_client_request_id and r.owner_user_id=v_uid;
 if v_room is null then
  if exists(select 1 from public.together_rooms r where r.client_request_id=p_client_request_id) then raise exception 'TOGETHER_REQUEST_ID_CONFLICT'; end if;
  insert into public.together_rooms as r(owner_user_id,mode,title,timezone,member_limit,join_policy,locked,push_template,shared_goal,client_request_id,status,created_at,updated_at)
  values(v_uid,p_mode,left(btrim(p_title),120),coalesce(nullif(btrim(p_timezone),''),'Asia/Seoul'),2,'invite',false,case when p_mode in ('watch','same_push') then p_push_template end,case when p_mode='shared_goal' then p_shared_goal end,p_client_request_id,'active',now(),now()) returning r.id into v_room;
  insert into public.together_room_members as m(room_id,user_id,role,display_name,status,joined_at) values(v_room,v_uid,'owner',v_display,'active',now()) on conflict on constraint together_room_members_pkey do update set role='owner',display_name=excluded.display_name,status='active',left_at=null;
 else
  update public.together_room_members as m set display_name=v_display,status='active',left_at=null where m.room_id=v_room and m.user_id=v_uid;
 end if;
 select i.code,i.expires_at into v_code,v_exp from public.together_invites i where i.room_id=v_room and i.revoked_at is null and i.expires_at>now() order by i.created_at desc limit 1;
 if v_code is null then
  loop v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
   begin insert into public.together_invites as i(room_id,code,created_by) values(v_room,v_code,v_uid) returning i.expires_at into v_exp; exit; exception when unique_violation then null; end;
  end loop;
 end if;
 return query select v_room,v_code,v_exp;
end $$;

create or replace function public.get_together_invite_preview_v2(p_code text) returns jsonb
language plpgsql security definer set search_path='' as $$ declare v jsonb; begin
 select jsonb_build_object('code',i.code,'title',r.title,'mode',r.mode,'timezone',r.timezone,'pushTemplate',r.push_template,'sharedGoal',r.shared_goal,'joinPolicy',r.join_policy,'locked',r.locked,'status',r.status,'memberCount',(select count(*) from public.together_room_members m where m.room_id=r.id and m.status='active'),'memberLimit',r.member_limit,'ownerDisplayName',coalesce((select m.display_name from public.together_room_members m where m.room_id=r.id and m.role='owner' and m.status='active' limit 1),'멤버'),'expiresAt',i.expires_at)
 into v from public.together_invites i join public.together_rooms r on r.id=i.room_id where upper(i.code)=upper(btrim(p_code)) and i.revoked_at is null and i.expires_at>now() and r.status='active' limit 1;
 if v is null then raise exception 'TOGETHER_INVITE_NOT_AVAILABLE'; end if; return v; end $$;

create or replace function public.accept_together_invite_v2(p_code text,p_display_name text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_inv public.together_invites%rowtype; v_room public.together_rooms%rowtype; v_count integer; v_display text:=left(coalesce(nullif(btrim(p_display_name),''),'멤버'),40);
begin
 if v_uid is null then raise exception 'TOGETHER_AUTH_REQUIRED'; end if;
 select * into v_inv from public.together_invites i where upper(i.code)=upper(btrim(p_code)) and i.revoked_at is null and i.expires_at>now() limit 1;
 if v_inv.id is null then raise exception 'TOGETHER_INVITE_NOT_AVAILABLE'; end if;
 select * into v_room from public.together_rooms r where r.id=v_inv.room_id and r.status='active';
 if v_room.id is null then raise exception 'TOGETHER_ROOM_NOT_ACTIVE'; end if;
 if exists(select 1 from public.together_room_blocks b where b.room_id=v_room.id and b.user_id=v_uid) then raise exception 'TOGETHER_MEMBER_BLOCKED'; end if;
 if v_room.locked then raise exception 'TOGETHER_ROOM_LOCKED'; end if;
 if v_room.join_policy='closed' then raise exception 'TOGETHER_ROOM_CLOSED'; end if;
 if exists(select 1 from public.together_room_members m where m.room_id=v_room.id and m.user_id=v_uid and m.status='active') then
  update public.together_room_members set display_name=v_display where room_id=v_room.id and user_id=v_uid;
  return jsonb_build_object('roomId',v_room.id,'joinStatus','active','mode',v_room.mode,'title',v_room.title,'pushTemplate',v_room.push_template,'sharedGoal',v_room.shared_goal);
 end if;
 if v_room.join_policy='approval' then
  insert into public.together_join_requests(room_id,user_id,display_name) values(v_room.id,v_uid,v_display) on conflict(room_id,user_id) do update set display_name=excluded.display_name,status='pending',requested_at=now(),resolved_at=null,resolved_by=null;
  update public.together_rooms as r set updated_at=now() where r.id=v_room.id;
  return jsonb_build_object('roomId',v_room.id,'joinStatus','pending','mode',v_room.mode,'title',v_room.title);
 end if;
 select count(*) into v_count from public.together_room_members m where m.room_id=v_room.id and m.status='active';
 if v_count>=v_room.member_limit then raise exception 'TOGETHER_ROOM_FULL'; end if;
 if v_inv.max_uses is not null and v_inv.used_count>=v_inv.max_uses then raise exception 'TOGETHER_INVITE_MAX_USES'; end if;
 insert into public.together_room_members(room_id,user_id,role,display_name,status,joined_at,left_at) values(v_room.id,v_uid,'member',v_display,'active',now(),null)
 on conflict(room_id,user_id) do update set role=case when public.together_room_members.role='owner' then 'owner' else 'member' end,display_name=excluded.display_name,status='active',joined_at=now(),left_at=null;
 update public.together_invites set used_count=used_count+1 where id=v_inv.id;
 return jsonb_build_object('roomId',v_room.id,'joinStatus','active','role','member','mode',v_room.mode,'title',v_room.title,'pushTemplate',v_room.push_template,'sharedGoal',v_room.shared_goal);
end $$;

create or replace function public.get_my_together_rooms_v2() returns table(room_id uuid,title text,mode text,room_status text,timezone text,member_limit integer,join_policy text,locked boolean,member_role text,member_count bigint,push_template jsonb,shared_goal jsonb,updated_at timestamptz)
language sql stable security definer set search_path='' as $$
 select r.id,r.title,r.mode,r.status,r.timezone,r.member_limit,r.join_policy,r.locked,me.role,(select count(*) from public.together_room_members m where m.room_id=r.id and m.status='active'),r.push_template,r.shared_goal,r.updated_at from public.together_room_members me join public.together_rooms r on r.id=me.room_id where me.user_id=auth.uid() and me.status='active' order by r.updated_at desc;
$$;

create or replace function public.get_together_room_snapshot_v2(p_room_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$ declare v_role text; v jsonb; begin
 select role into v_role from public.together_room_members where room_id=p_room_id and user_id=auth.uid() and status='active'; if v_role is null then raise exception 'TOGETHER_ROOM_ACCESS_DENIED'; end if;
 select jsonb_build_object('room',jsonb_build_object('id',r.id,'title',r.title,'mode',r.mode,'status',r.status,'timezone',r.timezone,'memberLimit',r.member_limit,'joinPolicy',r.join_policy,'locked',r.locked,'pushTemplate',r.push_template,'sharedGoal',r.shared_goal,'ownerUserId',r.owner_user_id,'myRole',v_role),'members',coalesce((select jsonb_agg(jsonb_build_object('userId',m.user_id,'displayName',m.display_name,'role',m.role,'status',m.status,'joinedAt',m.joined_at,'state',case when s.user_id is null then null else jsonb_build_object('localDate',s.local_date,'completed',s.completed,'progress',s.progress,'streak',s.streak,'contribution',s.contribution,'updatedAt',s.updated_at) end) order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end,m.joined_at) from public.together_room_members m left join public.together_member_states s on s.room_id=m.room_id and s.user_id=m.user_id where m.room_id=r.id and m.status='active'),'[]'::jsonb),'activeInvite',case when v_role in ('owner','admin') then (select jsonb_build_object('code',i.code,'expiresAt',i.expires_at) from public.together_invites i where i.room_id=r.id and i.revoked_at is null and i.expires_at>now() order by i.created_at desc limit 1) end,'joinRequests',case when v_role in ('owner','admin') then coalesce((select jsonb_agg(jsonb_build_object('userId',q.user_id,'displayName',q.display_name,'status',q.status,'requestedAt',q.requested_at)) from public.together_join_requests q where q.room_id=r.id and q.status='pending'),'[]'::jsonb) else '[]'::jsonb end,'blockedMembers',case when v_role in ('owner','admin') then coalesce((select jsonb_agg(jsonb_build_object('userId',b.user_id,'displayName',coalesce(m.display_name,'멤버'),'createdAt',b.created_at)) from public.together_room_blocks b left join public.together_room_members m on m.room_id=b.room_id and m.user_id=b.user_id where b.room_id=r.id),'[]'::jsonb) else '[]'::jsonb end) into v from public.together_rooms r where r.id=p_room_id;
 return v; end $$;

create or replace function public.upsert_together_member_state_v2(p_room_id uuid,p_local_date date,p_completed boolean,p_progress numeric,p_streak integer,p_contribution numeric,p_display_name text) returns void
language plpgsql security definer set search_path='' as $$ begin
 if not public.is_together_room_member(p_room_id) then raise exception 'TOGETHER_ROOM_ACCESS_DENIED'; end if;
 if not exists(select 1 from public.together_rooms r where r.id=p_room_id and r.status='active') then raise exception 'TOGETHER_ROOM_NOT_ACTIVE'; end if;
 update public.together_room_members set display_name=left(coalesce(nullif(btrim(p_display_name),''),'멤버'),40) where room_id=p_room_id and user_id=auth.uid();
 insert into public.together_member_states(room_id,user_id,local_date,completed,progress,streak,contribution) values(p_room_id,auth.uid(),p_local_date,coalesce(p_completed,false),case when p_progress is null then null else greatest(0,least(1,p_progress)) end,greatest(0,coalesce(p_streak,0)),greatest(0,coalesce(p_contribution,0))) on conflict(room_id,user_id) do update set local_date=excluded.local_date,completed=excluded.completed,progress=excluded.progress,streak=excluded.streak,contribution=excluded.contribution,updated_at=now();
 if coalesce(p_completed,false) then insert into public.together_completions(room_id,user_id,local_date,completed_at) values(p_room_id,auth.uid(),p_local_date,now()) on conflict(room_id,user_id,local_date) do update set completed_at=excluded.completed_at; else delete from public.together_completions where room_id=p_room_id and user_id=auth.uid() and local_date=p_local_date; end if;
end $$;

create or replace function public.rename_together_room_v2(p_room_id uuid,p_title text) returns void language plpgsql security definer set search_path='' as $$ begin if not public.is_together_room_admin(p_room_id,auth.uid()) then raise exception 'TOGETHER_ADMIN_REQUIRED'; end if; update public.together_rooms set title=left(btrim(p_title),120),updated_at=now() where id=p_room_id; end $$;
create or replace function public.set_together_room_locked_v2(p_room_id uuid,p_locked boolean) returns void language plpgsql security definer set search_path='' as $$ begin if not public.is_together_room_admin(p_room_id,auth.uid()) then raise exception 'TOGETHER_ADMIN_REQUIRED'; end if; update public.together_rooms set locked=coalesce(p_locked,false),updated_at=now() where id=p_room_id and status='active'; end $$;
create or replace function public.set_together_join_policy_v2(p_room_id uuid,p_join_policy text) returns void language plpgsql security definer set search_path='' as $$ begin if not public.is_together_room_admin(p_room_id,auth.uid()) then raise exception 'TOGETHER_ADMIN_REQUIRED'; end if; if p_join_policy not in ('invite','approval','closed','public') then raise exception 'TOGETHER_JOIN_POLICY_INVALID'; end if; update public.together_rooms set join_policy=p_join_policy,updated_at=now() where id=p_room_id and status='active'; end $$;
create or replace function public.revoke_together_invites_v2(p_room_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin if not public.is_together_room_admin(p_room_id,auth.uid()) then raise exception 'TOGETHER_ADMIN_REQUIRED'; end if; update public.together_invites set revoked_at=now() where room_id=p_room_id and revoked_at is null; end $$;
create or replace function public.reissue_together_invite_v2(p_room_id uuid) returns table(invite_code text,invite_expires_at timestamptz) language plpgsql security definer set search_path='' as $$ declare v text; e timestamptz; begin perform public.revoke_together_invites_v2(p_room_id); loop v:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)); begin insert into public.together_invites(room_id,code,created_by) values(p_room_id,v,auth.uid()) returning expires_at into e; exit; exception when unique_violation then null; end; end loop; return query select v,e; end $$;
create or replace function public.set_together_member_role_v2(p_room_id uuid,p_user_id uuid,p_role text) returns void language plpgsql security definer set search_path='' as $$ begin if not exists(select 1 from public.together_room_members where room_id=p_room_id and user_id=auth.uid() and role='owner' and status='active') then raise exception 'TOGETHER_OWNER_REQUIRED'; end if; if p_role not in ('admin','member') or p_user_id=auth.uid() then raise exception 'TOGETHER_ROLE_INVALID'; end if; update public.together_room_members set role=p_role where room_id=p_room_id and user_id=p_user_id and status='active' and role<>'owner'; end $$;
create or replace function public.remove_together_member_v2(p_room_id uuid,p_user_id uuid,p_block boolean) returns void language plpgsql security definer set search_path='' as $$ declare mine text; target text; begin select role into mine from public.together_room_members where room_id=p_room_id and user_id=auth.uid() and status='active'; select role into target from public.together_room_members where room_id=p_room_id and user_id=p_user_id and status='active'; if mine not in ('owner','admin') or target='owner' or (mine='admin' and target<>'member') then raise exception 'TOGETHER_ADMIN_TARGET_INVALID'; end if; update public.together_room_members set status='kicked',left_at=now() where room_id=p_room_id and user_id=p_user_id; if p_block then insert into public.together_room_blocks(room_id,user_id,blocked_by) values(p_room_id,p_user_id,auth.uid()) on conflict(room_id,user_id) do update set blocked_by=excluded.blocked_by,created_at=now(); end if; end $$;
create or replace function public.unblock_together_member_v2(p_room_id uuid,p_user_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin if not public.is_together_room_admin(p_room_id,auth.uid()) then raise exception 'TOGETHER_ADMIN_REQUIRED'; end if; delete from public.together_room_blocks where room_id=p_room_id and user_id=p_user_id; end $$;
create or replace function public.transfer_together_ownership_v2(p_room_id uuid,p_user_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin if not exists(select 1 from public.together_room_members where room_id=p_room_id and user_id=auth.uid() and role='owner' and status='active') then raise exception 'TOGETHER_OWNER_REQUIRED'; end if; update public.together_room_members set role='admin' where room_id=p_room_id and user_id=auth.uid(); update public.together_room_members set role='owner' where room_id=p_room_id and user_id=p_user_id and status='active'; update public.together_rooms set owner_user_id=p_user_id,updated_at=now() where id=p_room_id; end $$;
create or replace function public.leave_together_room_v2(p_room_id uuid) returns void language plpgsql security definer set search_path='' as $$ declare r text; begin select role into r from public.together_room_members where room_id=p_room_id and user_id=auth.uid() and status='active'; if r='owner' then raise exception 'TOGETHER_OWNER_MUST_TRANSFER_OR_CLOSE'; end if; update public.together_room_members set status='left',left_at=now() where room_id=p_room_id and user_id=auth.uid(); end $$;
create or replace function public.close_together_room_v2(p_room_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin if not exists(select 1 from public.together_room_members where room_id=p_room_id and user_id=auth.uid() and role='owner' and status='active') then raise exception 'TOGETHER_OWNER_REQUIRED'; end if; update public.together_rooms set status='closed',locked=true,updated_at=now() where id=p_room_id; update public.together_invites set revoked_at=now() where room_id=p_room_id and revoked_at is null; end $$;
create or replace function public.resolve_together_join_request_v2(p_room_id uuid,p_user_id uuid,p_approve boolean) returns void language plpgsql security definer set search_path='' as $$ declare q public.together_join_requests%rowtype; n integer; lim integer; begin if not public.is_together_room_admin(p_room_id,auth.uid()) then raise exception 'TOGETHER_ADMIN_REQUIRED'; end if; select * into q from public.together_join_requests where room_id=p_room_id and user_id=p_user_id and status='pending'; if q.user_id is null then raise exception 'TOGETHER_JOIN_REQUEST_NOT_FOUND'; end if; if not p_approve then update public.together_join_requests set status='rejected',resolved_at=now(),resolved_by=auth.uid() where room_id=p_room_id and user_id=p_user_id; update public.together_rooms as r set updated_at=now() where r.id=p_room_id; return; end if; select count(*),max(member_limit) into n,lim from public.together_room_members m join public.together_rooms r on r.id=m.room_id where m.room_id=p_room_id and m.status='active'; if n>=lim then raise exception 'TOGETHER_ROOM_FULL'; end if; insert into public.together_room_members(room_id,user_id,role,display_name,status,joined_at) values(p_room_id,p_user_id,'member',q.display_name,'active',now()) on conflict(room_id,user_id) do update set role='member',display_name=excluded.display_name,status='active',joined_at=now(),left_at=null; update public.together_join_requests set status='approved',resolved_at=now(),resolved_by=auth.uid() where room_id=p_room_id and user_id=p_user_id; update public.together_rooms as r set updated_at=now() where r.id=p_room_id; end $$;

revoke all on function public.create_together_room_v2(text,text,text,jsonb,jsonb,uuid,text),public.get_together_invite_preview_v2(text),public.accept_together_invite_v2(text,text) from public;
grant execute on function public.create_together_room_v2(text,text,text,jsonb,jsonb,uuid,text),public.accept_together_invite_v2(text,text) to authenticated;
grant execute on function public.get_together_invite_preview_v2(text) to anon,authenticated;
grant execute on function public.get_my_together_rooms_v2(),public.get_together_room_snapshot_v2(uuid),public.upsert_together_member_state_v2(uuid,date,boolean,numeric,integer,numeric,text),public.rename_together_room_v2(uuid,text),public.set_together_room_locked_v2(uuid,boolean),public.set_together_join_policy_v2(uuid,text),public.reissue_together_invite_v2(uuid),public.revoke_together_invites_v2(uuid),public.set_together_member_role_v2(uuid,uuid,text),public.remove_together_member_v2(uuid,uuid,boolean),public.unblock_together_member_v2(uuid,uuid),public.transfer_together_ownership_v2(uuid,uuid),public.leave_together_room_v2(uuid),public.close_together_room_v2(uuid),public.resolve_together_join_request_v2(uuid,uuid,boolean) to authenticated;

alter table public.together_member_states replica identity full;
alter table public.together_room_members replica identity full;
alter table public.together_rooms replica identity full;
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='together_rooms') then alter publication supabase_realtime add table public.together_rooms; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='together_room_members') then alter publication supabase_realtime add table public.together_room_members; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='together_member_states') then alter publication supabase_realtime add table public.together_member_states; end if;
 if exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='together_join_requests') then alter publication supabase_realtime drop table public.together_join_requests; end if;
end $$;
commit;

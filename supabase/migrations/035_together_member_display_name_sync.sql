create or replace function public.update_together_member_display_name_v2(
  p_room_id uuid,
  p_display_name text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text := left(
    coalesce(
      nullif(btrim(p_display_name), ''),
      '멤버'
    ),
    40
  );
  v_changed_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'TOGETHER_AUTH_REQUIRED';
  end if;

  update public.together_room_members
  set display_name = v_display_name
  where room_id = p_room_id
    and user_id = auth.uid()
    and status = 'active'
    and display_name is distinct from v_display_name;

  get diagnostics v_changed_count = row_count;

  if v_changed_count = 0 and not exists (
    select 1
    from public.together_room_members
    where room_id = p_room_id
      and user_id = auth.uid()
      and status = 'active'
  ) then
    raise exception 'TOGETHER_ROOM_ACCESS_DENIED';
  end if;

  return v_changed_count > 0;
end;
$$;

revoke all on function public.update_together_member_display_name_v2(
  uuid,
  text
) from public;

grant execute on function public.update_together_member_display_name_v2(
  uuid,
  text
) to authenticated;

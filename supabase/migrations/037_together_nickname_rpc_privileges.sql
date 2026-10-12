BEGIN;

REVOKE EXECUTE ON FUNCTION
  public.get_my_together_nickname_v2()
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.get_my_together_nickname_v2()
TO authenticated;

REVOKE EXECUTE ON FUNCTION
  public.set_my_together_nickname_v2(text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.set_my_together_nickname_v2(text)
TO authenticated;

REVOKE EXECUTE ON FUNCTION
  public.update_together_member_display_name_v2(uuid, text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.update_together_member_display_name_v2(uuid, text)
TO authenticated;

REVOKE EXECUTE ON FUNCTION
  public.enforce_together_official_display_name_v2()
FROM PUBLIC, anon, authenticated;

COMMIT;

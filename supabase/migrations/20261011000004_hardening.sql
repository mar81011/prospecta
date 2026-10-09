-- Hardening from the Supabase security advisor.

-- Trigger-only functions: nobody needs to call these through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;

-- Pin search_path like every other function.
alter function public.set_updated_at() set search_path = '';

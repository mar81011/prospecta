-- Local development seed. Plans and default settings are created by migrations.
--
-- Bootstrapping the first admin (there is deliberately no way to do this from the app):
--   1. Register normally at http://localhost:3000/register and confirm the email
--      (local emails are visible at http://127.0.0.1:54324).
--   2. Run in Supabase Studio (http://127.0.0.1:54323 → SQL editor) or psql:
--
--      update public.profiles set role = 'admin' where email = 'you@example.com';
--
-- Afterwards, admins can promote other users from /admin/agents/[id].

update public.app_settings
   set gcash_number = '0917 000 0000',
       gcash_account_name = 'Prospecta (dev)',
       support_email = 'support@example.com'
 where id;

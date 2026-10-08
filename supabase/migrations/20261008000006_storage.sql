-- Private bucket for optional payment screenshots.
-- Path convention: {agent_id}/{payment_id}.{ext}
-- Uploads happen server-side with the service role after the file's bytes are
-- validated, so there is intentionally no INSERT/UPDATE/DELETE policy for clients.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-screenshots', 'payment-screenshots', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "agents read own payment screenshots, admins read all"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-screenshots'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.is_admin())
    )
  );

-- Deleting an admin account must not be blocked by payments they reviewed or
-- settings they edited. Keep the records (audit history) and clear the link.

alter table public.payments
  drop constraint payments_reviewed_by_fkey,
  add constraint payments_reviewed_by_fkey
    foreign key (reviewed_by) references public.profiles (id) on delete set null;

alter table public.app_settings
  drop constraint app_settings_updated_by_fkey,
  add constraint app_settings_updated_by_fkey
    foreign key (updated_by) references public.profiles (id) on delete set null;

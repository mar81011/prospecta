-- Sign-up with a mobile number (SMS one-time code). Phone users have no email,
-- so their profile email is ''. Their number also becomes the contact number
-- shown on listing pages, formatted the Philippine way: 639171234567 -> 0917 123 4567.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g');
begin
  insert into public.profiles (id, email, name, phone)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    case
      when v_phone ~ '^639[0-9]{9}$'
        then '0' || substr(v_phone, 3, 3) || ' ' || substr(v_phone, 6, 3) || ' ' || substr(v_phone, 9, 4)
      else ''
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Create a Smart Lesson Builder user entirely from SQL.
--
-- Run this file once in the Supabase SQL Editor to define the function.
-- After that, adding a person is a single line:
--
--   select public.create_slb_user('new.person@thinkcerca.com', 'TempPassword123!');
--   select public.create_slb_user('someone@thinkcerca.com', 'TempPassword123!', 'admin');
--
-- The password you pass is TEMPORARY. The new account is flagged
-- password_set:false, so the app forces them through the Set Your Password
-- screen at first login and they choose their own. You only ever need to hand
-- over a throwaway string, and you never know their real password.
--
-- It does all four things a working account needs:
--   1. adds the address to allowed_signup_emails (else the signup trigger blocks it)
--   2. creates the auth.users row with the password already hashed and email confirmed
--   3. creates the matching auth.identities row, without which password login fails
--   4. writes the profiles row with the requested role
--
-- Written against GoTrue v2.185 / Postgres 17.

-- ── Let trusted contexts set roles ───────────────────────────────────
-- guard_profile_role blocks role assignment by non-admins. In the SQL Editor
-- and for service_role calls there is no JWT, so auth.uid() is null and the
-- guard would refuse to create an admin. Those contexts are already trusted —
-- RLS stops the anon key from reaching profiles at all — so allow them.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  -- No JWT: SQL Editor or service_role. Both are admin contexts.
  if auth.uid() is null then
    return new;
  end if;

  select role into caller_role from public.profiles where id = auth.uid();

  if tg_op = 'INSERT' then
    if new.role is not null and new.role <> 'builder' and caller_role is distinct from 'admin' then
      raise exception 'Cannot self-assign role %', new.role using errcode = '42501';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.role is distinct from old.role and caller_role is distinct from 'admin' then
      raise exception 'Only admins can change roles' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

-- ── The function ─────────────────────────────────────────────────────
create or replace function public.create_slb_user(
  p_email    text,
  p_password text,
  p_role     text default 'builder'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_email text := lower(trim(p_email));
  v_id    uuid := gen_random_uuid();
begin
  if p_role not in ('builder', 'designer', 'admin') then
    raise exception 'role must be builder, designer or admin (got %)', p_role;
  end if;

  if length(coalesce(p_password, '')) < 8 then
    raise exception 'password must be at least 8 characters';
  end if;

  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'user % already exists', v_email;
  end if;

  -- 1. allowlist first, or the auth.users trigger rejects the insert
  insert into public.allowed_signup_emails (email)
  values (v_email)
  on conflict (email) do nothing;

  -- 2. the account. Empty strings rather than NULL on the token columns:
  --    GoTrue errors with "converting NULL to string is unsupported" otherwise.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    -- password_set:false makes the app force them through SetPassword on first
    -- login, so the temporary password below is never the one they keep.
    '{"password_set": false}'::jsonb,
    '', '', '', ''
  );

  -- 3. identity row — password login fails silently without it
  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_id,
    jsonb_build_object(
      'sub', v_id::text,
      'email', v_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email', v_id::text, now(), now(), now()
  );

  -- 4. profile. A handle_new_user trigger may already have made one.
  insert into public.profiles (id, role, updated_at)
  values (v_id, p_role, now())
  on conflict (id) do update
    set role = excluded.role, updated_at = now();

  return v_id;
end;
$$;

-- Only the SQL Editor and service_role may call this. Without this revoke,
-- any signed-in user could mint themselves an admin account.
revoke all on function public.create_slb_user(text, text, text) from public, anon, authenticated;

-- ── Usage ────────────────────────────────────────────────────────────
-- select public.create_slb_user('new.person@thinkcerca.com', 'TheirPassword123!');
--
-- Returns the new user's uuid. They can sign in immediately and will be
-- prompted to set a display name.
--
-- Change someone's role later:
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'person@thinkcerca.com');
--
-- Remove someone (do both, in this order):
--   delete from public.allowed_signup_emails where email = 'person@thinkcerca.com';
--   delete from auth.users where email = 'person@thinkcerca.com';

-- Restrict account creation to an explicit allowlist, enforced in the database.
--
-- The previous check lived in Login.jsx and ran in the browser, so it could be
-- bypassed by calling supabase.auth.signUp directly with the public anon key,
-- or by editing the array in DevTools. This moves enforcement to a BEFORE
-- INSERT trigger on auth.users, which fires no matter how the signup is made:
-- the web UI, a raw REST call, or the admin API.

-- ── Allowlist table ──────────────────────────────────────────────────
create table if not exists public.allowed_signup_emails (
  email    text primary key,
  added_at timestamptz not null default now()
);

-- RLS on with no policies: unreachable from anon and authenticated clients.
-- Only service_role and SECURITY DEFINER functions can read it, so the list
-- of staff addresses is never exposed the way the bundled JS array was.
alter table public.allowed_signup_emails enable row level security;

insert into public.allowed_signup_emails (email) values
  ('eleblanc@thinkcerca.com'),
  ('eileen@thinkcerca.com'),
  ('nelson@thinkcerca.com'),
  ('lucas@thinkcerca.com'),
  ('liujing.ren@thinkcerca.com'),
  ('angella.niemer@thinkcerca.com'),
  ('maximilian@thinkcerca.com'),
  ('susan.buntrock@thinkcerca.com'),
  ('boxing.li@thinkcerca.com'),
  ('florencia@thinkcerca.com'),
  ('lorenzo.motta@thinkcerca.com'),
  ('allison.labadie@thinkcerca.com'),
  ('martin.manitto@thinkcerca.com'),
  ('afalcon@thinkcerca.com'),
  ('emurphy@thinkcerca.com'),
  ('michael.buckley@gmail.com'),
  ('asha.makwana@thinkcerca.com'),
  ('jessgnord@gmail.com')
on conflict (email) do nothing;

-- ── Signup gate ──────────────────────────────────────────────────────
create or replace function public.enforce_signup_allowlist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.allowed_signup_emails
    where email = lower(trim(new.email))
  ) then
    raise exception 'Email not permitted to sign up'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_signup_allowlist_trigger on auth.users;

create trigger enforce_signup_allowlist_trigger
  before insert on auth.users
  for each row
  execute function public.enforce_signup_allowlist();

-- ── Helper for the AI proxy ──────────────────────────────────────────
-- Lets api/ai.js confirm the caller is still on the allowlist, so an account
-- created before this migration cannot keep spending the AI quota.
create or replace function public.is_current_user_allowed()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.allowed_signup_emails
    where email = lower(auth.jwt() ->> 'email')
  );
$$;

grant execute on function public.is_current_user_allowed() to authenticated;

-- ── Adding someone later ─────────────────────────────────────────────
-- insert into public.allowed_signup_emails (email) values ('new.person@thinkcerca.com');
--
-- This is now the single source of truth. The admin create-user edge function
-- also inserts into auth.users, so it is subject to the same trigger: add the
-- address here first, then create the account.

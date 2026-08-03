-- Close the profiles RLS gap.
--
-- Found by probing the live database with nothing but the public anon key:
--
--   POST /rest/v1/profiles  {"id":"<random uuid>"}
--   -> 23503 foreign key violation
--
-- Error 23503 means the row passed the RLS WITH CHECK and was only stopped by
-- the FK to auth.users. (Compare lessons, which returns 42501 — blocked by RLS.)
-- So an unauthenticated caller could insert a profiles row for any id that
-- exists in auth.users. Combined with signup having been open, that gave a
-- path to self-assigning a role: create an account, then insert your own
-- profile row with role = 'admin'.
--
-- The app needs these four things to keep working:
--   App.jsx              select * where id = own
--   SetDisplayName.jsx   upsert  {id: own, display_name, updated_at}
--   BrowseLessons.jsx    select id, display_name for a set of other users
--   BrowseLessonTemplates.jsx  same
-- The policies below permit exactly that and nothing more.

alter table public.profiles enable row level security;

-- Drop whatever is currently there so this migration is the whole story.
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
  loop
    execute format('drop policy if exists %I on public.profiles', pol.policyname);
  end loop;
end $$;

-- SELECT: any signed-in user may read profiles. Needed to resolve author
-- display names in the browse pages. Note this exposes role and display_name
-- to every authenticated user; acceptable for an internal tool, and worth
-- revisiting if the audience widens.
create policy "Authenticated users can read profiles"
  on public.profiles for select
  to authenticated
  using (true);

-- INSERT: only your own row, and only when signed in. This is what closes
-- the anon hole.
create policy "Users can create their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- UPDATE: only your own row.
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- DELETE: nobody from the client.

-- ── Role escalation guard ────────────────────────────────────────────
-- The UPDATE policy above lets users edit their own row, which would still
-- allow setting their own role to 'admin'. Column-level control needs a
-- trigger.
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  select role into caller_role from public.profiles where id = auth.uid();

  if tg_op = 'INSERT' then
    -- A new self-created profile may not arrive pre-promoted.
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

drop trigger if exists guard_profile_role_trigger on public.profiles;

create trigger guard_profile_role_trigger
  before insert or update on public.profiles
  for each row
  execute function public.guard_profile_role();

-- ── Verify after running ─────────────────────────────────────────────
-- With the anon key, this should now return 42501 rather than 23503:
--
--   curl -X POST "$SUPABASE_URL/rest/v1/profiles" \
--     -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
--     -H 'Content-Type: application/json' \
--     -d '{"id":"00000000-0000-4000-8000-000000000000"}'
--
-- The service_role key bypasses RLS entirely, so the admin create-user
-- edge function is unaffected.

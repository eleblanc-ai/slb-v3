# Smart Lesson Builder — User Management

All of this runs in **Supabase → SQL Editor** (set the dropdown to **No limit**).

One-time: run `supabase/migrations/create_user_function.sql` once, or none of this works.

---

### Add a user

```sql
select public.create_slb_user('person@thinkcerca.com', 'TempPassword123!');
```

Roles: add a third argument — `'builder'` (default), `'designer'`, `'admin'`.

Tell them: *sign in at smart-lesson-builder.vercel.app with this temporary password; you'll be asked to choose your own.*

---

### Reset a password

```sql
update auth.users
set encrypted_password = extensions.crypt('TempPassword123!', extensions.gen_salt('bf')),
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
                         || '{"password_set": false}'::jsonb,
    updated_at = now()
where email = 'person@thinkcerca.com';
```

Both lines matter — the second is what makes them pick a new one.

---

### Delete a user

```sql
delete from public.profiles
where id = (select id from auth.users where email = 'person@thinkcerca.com');

delete from public.allowed_signup_emails
where email = 'person@thinkcerca.com';

delete from auth.users
where email = 'person@thinkcerca.com';
```

All three, in this order. `0 rows` on the first is fine.

---

### Change a role

```sql
update public.profiles
set role = 'admin', updated_at = now()
where id = (select id from auth.users where email = 'person@thinkcerca.com');
```

---

**Errors:** `create_slb_user does not exist` → run the migration file. `extensions.crypt does not exist` → `create extension if not exists pgcrypto with schema extensions;`. `Signups not allowed` → expected, accounts come from here only.

Questions → Emily.

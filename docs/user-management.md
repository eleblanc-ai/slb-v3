# Managing Smart Lesson Builder Users

Everything here runs in the **Supabase Dashboard → SQL Editor**. Set the dropdown to **No limit** before running.

**One-time setup:** run `supabase/migrations/create_user_function.sql` once. Nothing below works until you have.

---

## Add a user

```sql
select public.create_slb_user('new.person@thinkcerca.com', 'TempPassword123!');
```

For a different role — `builder` (default), `designer`, or `admin`:

```sql
select public.create_slb_user('boss@thinkcerca.com', 'TempPassword123!', 'admin');
```

Send them:

> Go to https://smart-lesson-builder.vercel.app and sign in with your email and the temporary password `TempPassword123!`. You'll be asked to choose your own password right away.

The password you type is temporary and stops working as soon as they pick their own. You never learn their real one.

---

## Reset someone's password

They forgot it, or it needs replacing:

```sql
update auth.users
set encrypted_password = extensions.crypt('TempPassword123!', extensions.gen_salt('bf')),
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
                         || '{"password_set": false}'::jsonb,
    updated_at = now()
where email = 'person@thinkcerca.com';
```

Give them the temporary password. Same as a new account: they're forced to pick their own at next login.

That second line is what forces it. Change only the password and they'd keep the temporary one forever.

---

## Delete a user

Run all three, in this order:

```sql
delete from public.profiles
where id = (select id from auth.users where email = 'person@thinkcerca.com');

delete from public.allowed_signup_emails
where email = 'person@thinkcerca.com';

delete from auth.users
where email = 'person@thinkcerca.com';
```

Order matters — `profiles` points at `auth.users`, so removing the account first can fail or leave an orphan row.

`0 rows` on the first statement is fine; it means they never got as far as having a profile.

**All three are needed.** Delete only the account and they stay on the allowlist, so they can be recreated. Delete only the allowlist and their existing login keeps working.

---

## Change someone's role

```sql
update public.profiles
set role = 'admin', updated_at = now()
where id = (select id from auth.users where email = 'person@thinkcerca.com');
```

Roles: `builder`, `designer`, `admin`. Users can't change their own — a trigger blocks it.

---

## See who exists

```sql
select u.email,
       p.role,
       p.display_name,
       u.last_sign_in_at,
       (u.raw_user_meta_data ->> 'password_set') as password_chosen
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at desc;
```

`password_chosen = false` means they haven't picked their own password yet.

---

## If something goes wrong

**`function public.create_slb_user does not exist`**
Run `supabase/migrations/create_user_function.sql` first.

**`function extensions.crypt does not exist`**
```sql
create extension if not exists pgcrypto with schema extensions;
```

**`user ... already exists`**
They already have an account. Reset their password instead, or delete them first.

**"Invalid login credentials"**
The password doesn't match. Retype it rather than pasting — a trailing space is the usual cause. If unsure, just reset it.

**"Signups not allowed for this instance"**
Expected. Self-signup is off for the whole project; accounts come from `create_slb_user` only.

---

## Why it works this way

Access used to be controlled by a list in `src/config/allowedEmails.js`. That check ran in the browser, so anyone could skip it and create an account — which is how an unapproved user got in on 2026-08-02. Editing that file never actually stopped anyone, and it published every staff address in the page source.

Access is now enforced in the database, where the browser can't reach:

| Layer | Stops |
|---|---|
| Trigger on `auth.users` | Signups for addresses not on the allowlist |
| RLS on `allowed_signup_emails` | The list being readable by the app |
| Check in `api/ai.js` | Off-list accounts spending the AI budget |

That's why adding someone is an `insert`, not a code change.

Questions → Emily.

# Adding a New Person to Smart Lesson Builder

**This process changed on 2026-08-02.** Adding an email to `src/config/allowedEmails.js` no longer works — that file has been deleted. The allowlist now lives in the database, because a list in the JavaScript bundle could be edited away in the browser and was publicly readable.

---

## Quickest way: one line of SQL

**One-time setup:** run `supabase/migrations/create_user_function.sql` in the Supabase SQL Editor. You only ever do this once.

After that, adding a person is a single line in the SQL Editor:

```sql
select public.create_slb_user('new.person@thinkcerca.com', 'TempPassword123!');
```

For a different role:

```sql
select public.create_slb_user('someone@thinkcerca.com', 'TempPassword123!', 'admin');
```

It allowlists the address, creates the account with email already confirmed, wires up the identity record, and sets the role — every step below, in one statement. It returns the new user's id.

**The password you pass is temporary.** Send it to them however you like; it stops working the moment they use it. At first login the app puts them straight onto a *Set Your Password* screen and won't let them past it until they choose their own. You never learn their real password, and there's nothing to rotate later.

So the handover is:

> Go to smart-lesson-builder.vercel.app, sign in with your email and the temporary password `TempPassword123!`. You'll be asked to pick your own password right away.

It refuses rather than half-finishing if the address already exists or the temporary password is under 8 characters.

Existing accounts are unaffected — the forced screen only applies to accounts created this way.

*(There's also `./scripts/create-user.sh` if you'd rather work from a terminal — same effect, needs the service role key in `.env`.)*

The manual steps below do the same thing by hand.

---

## Step 1 — Add the email to the allowlist (required)

Supabase Dashboard → **SQL Editor** → New query:

```sql
insert into public.allowed_signup_emails (email)
values ('new.person@thinkcerca.com')
on conflict (email) do nothing;
```

Use the address in lowercase, exactly as they'll type it at signup.

Until this row exists, **nothing else will work.** A database trigger on `auth.users` rejects any account creation for an address that isn't on the list — through the signup form, a direct API call, or the admin panel. There's no way around it, which is the point.

---

## Step 2 — Create the account for them

**Admin Dashboard → Create User.**

This is the only route right now. Self-signup is switched off for the whole Supabase project (verified 2026-08-02) — anyone who tries the **Sign up** button gets *"Signups not allowed for this instance"*, whether or not they're on the allowlist.

Creating the user from the Admin Dashboard uses the service role, but it still inserts into `auth.users`, so **Step 1 is still required.** It is not a bypass.

If self-signup is ever re-enabled, the person can sign up themselves with the exact address from Step 1, and the allowlist trigger will let them through.

---

## Checking the current list

```sql
select email, added_at
from public.allowed_signup_emails
order by added_at desc;
```

You can't read this table from the app or with the anon key — RLS blocks it. That's deliberate: the old JS file exposed all 17 staff addresses to anyone who viewed the page source.

---

## Removing someone

```sql
delete from public.allowed_signup_emails
where email = 'former.person@thinkcerca.com';
```

**This alone does not lock them out.** It prevents a *new* signup. An existing account keeps working until you also delete the user:

Supabase Dashboard → **Authentication → Users** → find them → Delete.

Do both, in that order.

---

## Roles

New accounts don't get an elevated role automatically. To make someone an admin or designer, an existing admin updates their profile row:

```sql
update public.profiles
set role = 'admin'          -- 'admin' | 'builder' | 'designer'
where id = (select id from auth.users where email = 'new.person@thinkcerca.com');
```

Users cannot change their own role. A trigger blocks it, so this has to come from an admin or the SQL editor.

---

## Troubleshooting

**"Signups not allowed for this instance"**
Expected — self-signup is off for the whole project. Create the account from the Admin Dashboard instead (Step 2).

**"Please reach out to the AI Lab for help." at signup**
The email isn't on the allowlist. Run Step 1, then have them retry. Check for typos and a trailing space. (Only reachable if self-signup gets re-enabled.)

**Signed up fine, but AI generation fails with "Account not permitted to use AI features"**
The account exists but isn't on the allowlist — this happens for accounts created before 2026-08-02, when signup was briefly open. Run Step 1 for their address and it resolves immediately; no new account needed.

**They can log in but see nothing / can't reach the right pages**
That's a role problem, not an access problem. See Roles above.

---

## Why it works this way

The old allowlist was a check in `Login.jsx` that ran in the user's browser. Anyone could skip it by calling the signup API directly with the public key from the page source, which is how an unapproved account got created. Enforcement now sits in the database, where the client can't reach it.

Three layers, in case one is misconfigured:

| Layer | What it stops |
|---|---|
| Trigger on `auth.users` | Any signup for an off-list address, from any client |
| RLS on `allowed_signup_emails` | The list being read by the app or the anon key |
| Allowlist check in `api/ai.js` | Off-list accounts spending the AI budget |

Questions → Emily.

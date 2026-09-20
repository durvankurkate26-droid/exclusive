# Setting up EXCLUSIVE

Everything the app needs from Supabase and Google Cloud, in the order you should do it.
Budget about 25 minutes the first time, most of it waiting for Google's consent screen
form.

Nothing here is optional except **Part 4 (Google sign-in)** — email and password work
without it.

---

## Part 0 — What you need before you start

- A Supabase account (the free tier is enough)
- A Google account, if you want Google sign-in
- This repo cloned, `npm install` run

---

## Part 1 — Create the Supabase project

1. Go to <https://supabase.com/dashboard> → **New project**.
2. Name it whatever you like. **Save the database password somewhere** — it is shown
   once and you need it in step 3.
3. Pick the region closest to your users. This is the single biggest lever on how fast
   the app feels, and it cannot be changed later without recreating the project.
4. Wait for provisioning (~2 minutes).

### Get the keys

**Project Settings → API**:

| Dashboard field | Goes in `.env.local` as |
| --- | --- |
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` `secret` key | `SUPABASE_SERVICE_ROLE_KEY` |

**Project Settings → Database → Connection string → URI**: that whole string goes in
`SUPABASE_DB_URL`. Replace `[YOUR-PASSWORD]` with the password from step 2.

> If your network blocks direct connections on port 5432, use the **Session pooler**
> connection string instead. Both work for migrations.

Now:

```bash
cp .env.example .env.local
```

and fill in the four values, plus `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.

`.env.local` is gitignored. The anon key is designed to be public — Row Level Security
is what protects the data, not key secrecy. The **service-role key is not**: it bypasses
RLS entirely. It is only ever read by `npm run db:seed`, never by the app.

---

## Part 2 — Apply the schema

```bash
npm run db:push
```

This runs `supabase/migrations/*.sql` in order, each in its own transaction:

| File | What it creates |
| --- | --- |
| `0001_schema.sql` | Every table, the `handle_new_user` trigger, the access-check functions |
| `0002_rls.sql` | Row Level Security on all 18 tables |
| `0003_functions.sql` | `create_group`, `join_group_by_code`, the two cross-room promotions |
| `0004_storage.sql` | The `avatars` and `vault-media` buckets, both private, with path-scoped policies |
| `0005_realtime.sql` | Puts the live tables in the `supabase_realtime` publication |

It is safe to re-run: every statement is `create or replace`, `if not exists`, or
guarded.

### Check it worked

**Table Editor** should list `profiles`, `groups`, `teas`, `plans`, `memory_capsules`
and the rest. **Storage** should show two buckets, `avatars` and `vault-media`, both
marked **Private**.

> **If either bucket says Public, stop and fix it.** A public bucket means every
> photograph in the Vault is readable by anyone who ever sees one URL, forever. The
> migration creates them private; only a manual change makes them otherwise.

---

## Part 3 — Configure Auth

**Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` for local work; your real domain in production.
- **Redirect URLs** — add both:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/auth/confirm`

  Add the production equivalents when you deploy. Supabase rejects any redirect not on
  this list, which is what stops an attacker sending your users' sign-in codes to
  their own server.

**Authentication → Providers → Email**: leave **Enable Email provider** on.

**Confirm email** is on by default. Keep it on for production. For local development
you may want it off — otherwise every test account needs a real inbox. With it on,
`signUp` returns "Check your email to confirm", which is handled and shown.

### Email templates

**Authentication → Email Templates**. The default **Confirm signup** template points at
`{{ .ConfirmationURL }}`, which works as-is.

For **Reset password**, change the link to:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
```

The default template uses a `code` parameter that `/auth/callback` expects; recovery
links carry a `token_hash` instead, which is what `/auth/confirm` is built for. Without
this change, password reset links land on an error.

---

## Part 4 — Google sign-in (optional)

Two halves: create the credential in Google Cloud, then paste it into Supabase.

### 4a — Google Cloud Console

1. <https://console.cloud.google.com> → project picker → **New Project**. Name it after
   your app. Create, then make sure it is selected.

2. **APIs & Services → OAuth consent screen**:
   - **User Type**: **External** (unless you have a Workspace org and only want people
     inside it).
   - **App name**: what users see on the consent screen. Use the real product name.
   - **User support email**: yours.
   - **Developer contact**: yours.
   - **Scopes**: you do not need to add any. The defaults (`email`, `profile`,
     `openid`) are exactly what the `handle_new_user` trigger reads.
   - **Test users**: while the app is in *Testing*, only emails listed here can sign
     in. Add your own and anyone testing with you. This is the single most common
     reason Google sign-in "doesn't work" — the error is a generic access-denied.
   - Save.

3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - **Application type**: **Web application**
   - **Name**: anything, e.g. "EXCLUSIVE web"
   - **Authorised JavaScript origins**:
     - `http://localhost:3000`
     - your production origin, e.g. `https://exclusive.example.com`
   - **Authorised redirect URIs** — this is the one that matters:

     ```
     https://<your-project-ref>.supabase.co/auth/v1/callback
     ```

     **Not** your app's URL. The OAuth round trip goes
     `your app → Google → Supabase → your app`, and Google is handing the code to
     *Supabase*, which then redirects to `/auth/callback` on your side. Putting your
     own domain here produces `redirect_uri_mismatch` every time.

     You can find `<your-project-ref>` in your Supabase Project URL.

   - Create. Copy the **Client ID** and **Client secret**.

### 4b — Supabase

**Authentication → Providers → Google**:

- Toggle **Enable Sign in with Google** on
- **Client ID** and **Client Secret**: paste from 4a
- Save

The callback URL Supabase displays here should match exactly what you pasted into
Google's redirect URIs. If it does not, copy Supabase's version into Google.

### Going live

While the consent screen is in **Testing**, only your listed test users can sign in and
refresh tokens expire after 7 days. To open it up, **Publish app** on the consent
screen. Apps requesting only `email`/`profile`/`openid` are not subject to Google's
verification review.

---

## Part 5 — Seed the demo group

```bash
npm run db:seed
```

Creates nine accounts, one group, and a full loop of content: a conversation mid-
argument in TEA, four ideas with different amounts of support in ONE DAY, two things
being made in CREATE, one open plan with a genuine scheduling disagreement and one
locked plan in ALIGN, and three memory capsules in VAULT.

It prints the sign-in details when it finishes. Every account uses the same password,
and the group's invite code is `DEMO247`.

Safe to run twice — it finds what it made last time instead of duplicating it.

**It does not upload photographs.** The Vault's storage policies are path-scoped and
the only way to know they work is to watch a real upload succeed, so the capsules are
created empty and you add images through the UI. A seeded photo would prove nothing
about the thing most likely to be misconfigured.

---

## Part 6 — Run it

```bash
npm run dev
```

Open <http://localhost:3000>, click through to sign-in, and use one of the seeded
accounts.

---

## Verifying it actually works

Worth doing once, in this order. Each step tests something the one before it cannot.

| # | Check | How | Passes when |
| --- | --- | --- | --- |
| 1 | Email auth | Sign up with a new address | You land on `/onboarding`, not an error |
| 2 | Profile trigger | Look at `profiles` in the Table Editor | A row exists for the new user, created automatically |
| 3 | Google auth | Sign in with Google | You land on `/onboarding` or `/app`, and `avatar_url` is populated |
| 4 | Group creation | Create a group | You land in it as **owner** |
| 5 | Invite | Open `/join/DEMO247` in a private window as a second account | Preview shows the group name and member count, and joining works |
| 6 | **RLS** | Sign in as an outsider, visit `/g/the-group-chat` | You get the 404 page, not the group and not a 403 |
| 7 | Realtime | Open the same TEA thread in two browsers, send a message | It appears in both without a refresh |
| 8 | Storage write | Upload photos to a Vault capsule | Thumbnails appear; objects show under `vault-media/<group-id>/<capsule-id>/` |
| 9 | Storage read | Reload the capsule | Images still render (fresh signed URLs each load) |
| 10 | **Storage RLS** | Copy an image's signed URL, wait an hour, reload it | It 400s — signed URLs are meant to expire |
| 11 | Cross-room | ONE DAY → *Make this real* | A plan appears in ALIGN with everyone who raised a hand already marked **in** |
| 12 | Cross-room | CREATE → *Schedule the shoot* | Same, with the crew carried over |
| 13 | Cross-room | ALIGN → lock a plan → *put it in the Vault* | A capsule appears with the attendees tagged and the date filled in |

Step 6 is the one that matters most. If an outsider can see another group's data, every
other check is irrelevant.

---

## Deploying

1. Set the same four environment variables in your host's dashboard, with
   `NEXT_PUBLIC_SITE_URL` pointing at the real domain.
2. Add the production `/auth/callback` and `/auth/confirm` URLs to Supabase's
   **Redirect URLs**, and change **Site URL** to the real domain.
3. Add the production origin to Google's **Authorised JavaScript origins**.
   The redirect URI stays the Supabase one — it does not change between environments.
4. Do **not** set `SUPABASE_SERVICE_ROLE_KEY` in the deployed environment. Nothing the
   app serves reads it; only the local seed script does. Leaving it out means a
   server-side mistake cannot reach past RLS.

---

## When something is wrong

**"Supabase is not configured"** — `.env.local` is missing or incomplete. Both
`NEXT_PUBLIC_` values must be set, and Next only reads the file at startup, so restart
the dev server after editing it.

**`redirect_uri_mismatch` from Google** — the Authorised redirect URI in Google Cloud
must be `https://<project-ref>.supabase.co/auth/v1/callback`, not your app's URL. See
4a step 3.

**Google sign-in returns access-denied** — your consent screen is in *Testing* and the
account is not in the test-user list.

**"infinite recursion detected in policy"** — a policy is querying the table it is
defined on. The `is_group_member` / `is_group_admin` functions exist to prevent this;
any new policy on `group_members` must use them rather than a subquery.

**Messages do not arrive live** — `0005_realtime.sql` has not been applied, or the
table is not in the publication. Check under **Database → Publications →
supabase_realtime**.

**Vault images render as initials or blanks** — the signed URL was refused. Confirm the
uploader is a member of the group whose id is the first path segment, and that the
bucket is private but the policies from `0004_storage.sql` exist.

**Password reset links error** — the email template still points at
`{{ .ConfirmationURL }}`. See Part 3.

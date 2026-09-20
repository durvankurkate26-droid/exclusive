-- ===========================================================================
-- EXCLUSIVE — 0001 schema
--
-- Every table is group-scoped. The single invariant the whole product rests on:
-- a row is visible only to members of the group it belongs to. That is enforced in
-- 0002_rls.sql; this file builds the shapes and the helper functions the policies
-- are written against.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- utilities

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- profiles

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text not null,
  display_name  text not null,
  avatar_url    text,
  bio           text,
  -- Reserved for the custom EXCLUSIVE avatar system. Nothing reads it yet; it exists
  -- so adding one later is a write, not a migration of every existing profile.
  avatar_config jsonb not null default '{}'::jsonb,
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_]{3,20}$')
);

-- Case-insensitive uniqueness without requiring the citext extension.
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

/*
 * Every auth user gets a profile row immediately, with placeholder values pulled from
 * whatever the provider gave us. `onboarded_at` stays null until the user confirms
 * their name and username, which is how the app knows to route them to onboarding.
 *
 * Doing this in a trigger rather than in application code means there is no window
 * where an authenticated user exists without a profile — a window that otherwise
 * produces foreign-key failures on their very first action.
 */
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
  suffix int := 0;
begin
  base_username := lower(regexp_replace(
    coalesce(
      new.raw_user_meta_data->>'user_name',
      new.raw_user_meta_data->>'preferred_username',
      split_part(coalesce(new.email, 'friend'), '@', 1)
    ),
    '[^a-zA-Z0-9_]', '', 'g'
  ));
  if length(base_username) < 3 then
    base_username := 'friend';
  end if;
  base_username := left(base_username, 16);

  final_username := base_username;
  while exists (select 1 from public.profiles where lower(username) = final_username) loop
    suffix := suffix + 1;
    final_username := left(base_username, 16) || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    final_username,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      final_username
    ),
    nullif(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- groups

create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 1 and 60),
  description text,
  slug        text not null unique,
  invite_code text not null unique,
  created_by  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists groups_set_updated_at on public.groups;
create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();

create table if not exists public.group_members (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create index if not exists group_members_user_idx on public.group_members (user_id);
create index if not exists group_members_group_idx on public.group_members (group_id);

-- ---------------------------------------------------------------- access helpers
/*
 * These exist to break RLS recursion.
 *
 * A policy on `group_members` that itself selects from `group_members` re-enters the
 * policy and Postgres aborts with "infinite recursion detected in policy". Marking
 * these SECURITY DEFINER runs the lookup as the function owner, which skips RLS on
 * the inner read and terminates cleanly.
 *
 * `set search_path = public` is not decoration: a SECURITY DEFINER function without a
 * pinned search_path can be hijacked by a caller-controlled schema.
 */

create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_admin(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

/** Groups the current user belongs to — used by profile visibility policies. */
create or replace function public.my_group_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select group_id from public.group_members where user_id = auth.uid();
$$;

-- ---------------------------------------------------------------- TEA

create table if not exists public.teas (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title      text not null check (char_length(trim(title)) between 1 and 140),
  context    text,
  status     text not null default 'brewing' check (status in ('brewing', 'spilled', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists teas_group_idx on public.teas (group_id, updated_at desc);

drop trigger if exists teas_set_updated_at on public.teas;
create trigger teas_set_updated_at
  before update on public.teas
  for each row execute function public.set_updated_at();

create table if not exists public.tea_messages (
  id         uuid primary key default gen_random_uuid(),
  tea_id     uuid not null references public.teas(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  content    text not null check (char_length(trim(content)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tea_messages_tea_idx on public.tea_messages (tea_id, created_at);

drop trigger if exists tea_messages_set_updated_at on public.tea_messages;
create trigger tea_messages_set_updated_at
  before update on public.tea_messages
  for each row execute function public.set_updated_at();

create table if not exists public.tea_reactions (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.tea_messages(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  reaction   text not null check (char_length(reaction) between 1 and 8),
  created_at timestamptz not null default now(),
  unique (message_id, user_id, reaction)
);

create index if not exists tea_reactions_message_idx on public.tea_reactions (message_id);

create or replace function public.can_access_tea(tid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.teas t
    join public.group_members gm on gm.group_id = t.group_id
    where t.id = tid and gm.user_id = auth.uid()
  );
$$;

create or replace function public.can_access_tea_message(mid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.tea_messages m
    join public.teas t on t.id = m.tea_id
    join public.group_members gm on gm.group_id = t.group_id
    where m.id = mid and gm.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------- ONE DAY

create table if not exists public.one_day_ideas (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups(id) on delete cascade,
  created_by  uuid not null references public.profiles(id) on delete cascade,
  title       text not null check (char_length(trim(title)) between 1 and 120),
  description text,
  image_url   text,
  status      text not null default 'idea'
              check (status in ('idea', 'ready_to_plan', 'moved_to_align', 'completed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists one_day_group_idx on public.one_day_ideas (group_id, created_at desc);

drop trigger if exists one_day_set_updated_at on public.one_day_ideas;
create trigger one_day_set_updated_at
  before update on public.one_day_ideas
  for each row execute function public.set_updated_at();

create table if not exists public.one_day_interest (
  id         uuid primary key default gen_random_uuid(),
  idea_id    uuid not null references public.one_day_ideas(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  interested boolean not null default true,
  created_at timestamptz not null default now(),
  unique (idea_id, user_id)
);

create index if not exists one_day_interest_idea_idx on public.one_day_interest (idea_id);

create or replace function public.can_access_idea(iid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.one_day_ideas i
    join public.group_members gm on gm.group_id = i.group_id
    where i.id = iid and gm.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------- CREATE

create table if not exists public.create_ideas (
  id            uuid primary key default gen_random_uuid(),
  group_id      uuid not null references public.groups(id) on delete cascade,
  created_by    uuid not null references public.profiles(id) on delete cascade,
  title         text not null check (char_length(trim(title)) between 1 and 120),
  description   text,
  reference_url text,
  thumbnail_url text,
  status        text not null default 'idea'
                check (status in ('idea', 'people_joining', 'scheduled', 'shot', 'editing', 'posted', 'completed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists create_ideas_group_idx on public.create_ideas (group_id, created_at desc);

drop trigger if exists create_ideas_set_updated_at on public.create_ideas;
create trigger create_ideas_set_updated_at
  before update on public.create_ideas
  for each row execute function public.set_updated_at();

create table if not exists public.create_members (
  id                   uuid primary key default gen_random_uuid(),
  create_id            uuid not null references public.create_ideas(id) on delete cascade,
  user_id              uuid not null references public.profiles(id) on delete cascade,
  role                 text check (role in ('camera', 'editor', 'appearing', 'director')),
  participation_status text not null default 'in' check (participation_status in ('in', 'maybe', 'out')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (create_id, user_id)
);

create index if not exists create_members_create_idx on public.create_members (create_id);

drop trigger if exists create_members_set_updated_at on public.create_members;
create trigger create_members_set_updated_at
  before update on public.create_members
  for each row execute function public.set_updated_at();

create or replace function public.can_access_create(cid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.create_ideas c
    join public.group_members gm on gm.group_id = c.group_id
    where c.id = cid and gm.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------- ALIGN

create table if not exists public.plans (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references public.groups(id) on delete cascade,
  -- Where this plan came from. Both nullable: a plan can be started from scratch.
  source_idea_id   uuid references public.one_day_ideas(id) on delete set null,
  source_create_id uuid references public.create_ideas(id) on delete set null,
  created_by       uuid not null references public.profiles(id) on delete cascade,
  title            text not null check (char_length(trim(title)) between 1 and 120),
  description      text,
  status           text not null default 'open' check (status in ('open', 'locked', 'done', 'cancelled')),
  final_date       timestamptz,
  final_location   text,
  final_budget     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists plans_group_idx on public.plans (group_id, created_at desc);

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

create table if not exists public.plan_options (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.plans(id) on delete cascade,
  option_type text not null check (option_type in ('date', 'location', 'budget')),
  value       text not null check (char_length(trim(value)) between 1 and 200),
  metadata    jsonb not null default '{}'::jsonb,
  created_by  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists plan_options_plan_idx on public.plan_options (plan_id, option_type);

create table if not exists public.plan_votes (
  id         uuid primary key default gen_random_uuid(),
  option_id  uuid not null references public.plan_options(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (option_id, user_id)
);

create index if not exists plan_votes_option_idx on public.plan_votes (option_id);

create table if not exists public.plan_members (
  id                uuid primary key default gen_random_uuid(),
  plan_id           uuid not null references public.plans(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  attendance_status text not null default 'maybe' check (attendance_status in ('in', 'maybe', 'out')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (plan_id, user_id)
);

create index if not exists plan_members_plan_idx on public.plan_members (plan_id);

drop trigger if exists plan_members_set_updated_at on public.plan_members;
create trigger plan_members_set_updated_at
  before update on public.plan_members
  for each row execute function public.set_updated_at();

create or replace function public.can_access_plan(pid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.plans p
    join public.group_members gm on gm.group_id = p.group_id
    where p.id = pid and gm.user_id = auth.uid()
  );
$$;

create or replace function public.can_access_plan_option(oid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.plan_options o
    join public.plans p on p.id = o.plan_id
    join public.group_members gm on gm.group_id = p.group_id
    where o.id = oid and gm.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------- VAULT

create table if not exists public.memory_capsules (
  id               uuid primary key default gen_random_uuid(),
  group_id         uuid not null references public.groups(id) on delete cascade,
  created_by       uuid not null references public.profiles(id) on delete cascade,
  title            text not null check (char_length(trim(title)) between 1 and 120),
  description      text,
  cover_url        text,
  memory_date      date,
  source_plan_id   uuid references public.plans(id) on delete set null,
  source_create_id uuid references public.create_ideas(id) on delete set null,
  source_idea_id   uuid references public.one_day_ideas(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists capsules_group_idx on public.memory_capsules (group_id, memory_date desc nulls last);

drop trigger if exists capsules_set_updated_at on public.memory_capsules;
create trigger capsules_set_updated_at
  before update on public.memory_capsules
  for each row execute function public.set_updated_at();

create table if not exists public.memory_media (
  id           uuid primary key default gen_random_uuid(),
  capsule_id   uuid not null references public.memory_capsules(id) on delete cascade,
  uploaded_by  uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  media_type   text not null default 'image' check (media_type in ('image', 'video')),
  caption      text,
  width        int,
  height       int,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists memory_media_capsule_idx on public.memory_media (capsule_id, sort_order, created_at);

create table if not exists public.memory_members (
  id         uuid primary key default gen_random_uuid(),
  capsule_id uuid not null references public.memory_capsules(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (capsule_id, user_id)
);

create table if not exists public.memory_notes (
  id         uuid primary key default gen_random_uuid(),
  capsule_id uuid not null references public.memory_capsules(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  note       text not null check (char_length(trim(note)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists memory_notes_capsule_idx on public.memory_notes (capsule_id, created_at);

create or replace function public.can_access_capsule(cid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.memory_capsules c
    join public.group_members gm on gm.group_id = c.group_id
    where c.id = cid and gm.user_id = auth.uid()
  );
$$;

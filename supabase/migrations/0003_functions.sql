-- ===========================================================================
-- EXCLUSIVE — 0003 RPCs
--
-- Group creation and joining both need to do something RLS deliberately forbids:
-- creation writes two tables that must both succeed, and joining requires reading a
-- group you are not yet a member of. Doing either from the client means either a
-- half-created group or a policy loose enough to leak every group's existence.
--
-- Both live here as SECURITY DEFINER functions with a pinned search_path, and both
-- re-check auth.uid() themselves — being SECURITY DEFINER means RLS is off inside,
-- so the function *is* the access control.
-- ===========================================================================

-- ---------------------------------------------------------------- helpers

/** URL-safe slug from a group name, with a short suffix so names can repeat. */
create or replace function public.generate_group_slug(group_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  attempt int := 0;
begin
  base := lower(regexp_replace(trim(group_name), '[^a-zA-Z0-9]+', '-', 'g'));
  base := trim(both '-' from base);
  if base = '' then base := 'group'; end if;
  base := left(base, 32);

  loop
    candidate := base || '-' || lower(substr(encode(gen_random_bytes(3), 'hex'), 1, 5));
    exit when not exists (select 1 from public.groups where slug = candidate);
    attempt := attempt + 1;
    if attempt > 20 then
      raise exception 'could not generate a unique slug';
    end if;
  end loop;

  return candidate;
end;
$$;

/**
 * Invite code. Deliberately excludes 0/O/1/I/L — these get read aloud and typed by
 * hand in a group chat, and an ambiguous character turns into a support message.
 */
create or replace function public.generate_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
  attempt int := 0;
begin
  loop
    candidate := '';
    for i in 1..7 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.groups where invite_code = candidate);
    attempt := attempt + 1;
    if attempt > 30 then
      raise exception 'could not generate a unique invite code';
    end if;
  end loop;

  return candidate;
end;
$$;

-- ---------------------------------------------------------------- create group

create or replace function public.create_group(
  group_name text,
  group_description text default null
)
returns table (id uuid, slug text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_group public.groups;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if group_name is null or char_length(trim(group_name)) = 0 then
    raise exception 'group name is required' using errcode = '22023';
  end if;

  insert into public.groups (name, description, slug, invite_code, created_by)
  values (
    trim(group_name),
    nullif(trim(coalesce(group_description, '')), ''),
    public.generate_group_slug(group_name),
    public.generate_invite_code(),
    uid
  )
  returning * into new_group;

  -- Same transaction: a group without its owner is unreachable by anyone, including
  -- the person who just made it.
  insert into public.group_members (group_id, user_id, role)
  values (new_group.id, uid, 'owner');

  return query select new_group.id, new_group.slug, new_group.invite_code;
end;
$$;

-- ---------------------------------------------------------------- join by code

/**
 * What an invited person is allowed to see *before* joining: the name and how many
 * people are inside. Not the members, not the slug, not the contents. Returns no row
 * for a bad code, so this cannot be used to enumerate groups beyond confirming a
 * guessed 7-character code — which is the same thing accepting the code does anyway.
 */
create or replace function public.get_invite_preview(code text)
returns table (name text, description text, member_count bigint, already_member boolean)
language sql
security definer
stable
set search_path = public
as $$
  select
    g.name,
    g.description,
    (select count(*) from public.group_members gm where gm.group_id = g.id),
    exists (
      select 1 from public.group_members gm
      where gm.group_id = g.id and gm.user_id = auth.uid()
    )
  from public.groups g
  where g.invite_code = upper(trim(code));
$$;

create or replace function public.join_group_by_code(code text)
returns table (id uuid, slug text, name text, already_member boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  target public.groups;
  existing_member boolean;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into target from public.groups g where g.invite_code = upper(trim(code));
  if not found then
    raise exception 'invalid invite code' using errcode = 'P0002';
  end if;

  select exists (
    select 1 from public.group_members gm
    where gm.group_id = target.id and gm.user_id = uid
  ) into existing_member;

  if not existing_member then
    insert into public.group_members (group_id, user_id, role)
    values (target.id, uid, 'member')
    on conflict (group_id, user_id) do nothing;
  end if;

  return query select target.id, target.slug, target.name, existing_member;
end;
$$;

-- ---------------------------------------------------------------- invite rotation

create or replace function public.rotate_invite_code(gid uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  fresh text;
begin
  if not public.is_group_admin(gid) then
    raise exception 'only admins can rotate the invite code' using errcode = '42501';
  end if;
  fresh := public.generate_invite_code();
  update public.groups set invite_code = fresh where id = gid;
  return fresh;
end;
$$;

-- ---------------------------------------------------------------- cross-room

/**
 * ONE DAY -> ALIGN, and CREATE -> ALIGN.
 *
 * Both promotions create a plan, remember where it came from, mark the source, and
 * seed the plan's attendance from whoever had already raised their hand. That last
 * part is the point: the people who said "I'm in" on the idea should not have to say
 * it again on the plan.
 */
create or replace function public.promote_idea_to_plan(idea uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  src public.one_day_ideas;
  new_plan_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into src from public.one_day_ideas where id = idea;
  if not found or not public.is_group_member(src.group_id) then
    raise exception 'idea not found' using errcode = 'P0002';
  end if;

  insert into public.plans (group_id, source_idea_id, created_by, title, description)
  values (src.group_id, src.id, uid, src.title, src.description)
  returning id into new_plan_id;

  insert into public.plan_members (plan_id, user_id, attendance_status)
  select new_plan_id, i.user_id, 'in'
  from public.one_day_interest i
  where i.idea_id = src.id and i.interested
  on conflict (plan_id, user_id) do nothing;

  insert into public.plan_members (plan_id, user_id, attendance_status)
  values (new_plan_id, uid, 'in')
  on conflict (plan_id, user_id) do nothing;

  update public.one_day_ideas set status = 'moved_to_align' where id = src.id;

  return new_plan_id;
end;
$$;

create or replace function public.promote_create_to_plan(creation uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  src public.create_ideas;
  new_plan_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into src from public.create_ideas where id = creation;
  if not found or not public.is_group_member(src.group_id) then
    raise exception 'creation not found' using errcode = 'P0002';
  end if;

  insert into public.plans (group_id, source_create_id, created_by, title, description)
  values (src.group_id, src.id, uid, 'Shoot: ' || src.title, src.description)
  returning id into new_plan_id;

  insert into public.plan_members (plan_id, user_id, attendance_status)
  select new_plan_id, m.user_id, 'in'
  from public.create_members m
  where m.create_id = src.id and m.participation_status = 'in'
  on conflict (plan_id, user_id) do nothing;

  insert into public.plan_members (plan_id, user_id, attendance_status)
  values (new_plan_id, uid, 'in')
  on conflict (plan_id, user_id) do nothing;

  update public.create_ideas set status = 'scheduled' where id = src.id;

  return new_plan_id;
end;
$$;

-- ---------------------------------------------------------------- permissions

revoke all on function public.create_group(text, text) from public;
revoke all on function public.join_group_by_code(text) from public;
revoke all on function public.get_invite_preview(text) from public;
revoke all on function public.rotate_invite_code(uuid) from public;
revoke all on function public.promote_idea_to_plan(uuid) from public;
revoke all on function public.promote_create_to_plan(uuid) from public;

grant execute on function public.create_group(text, text) to authenticated;
grant execute on function public.join_group_by_code(text) to authenticated;
grant execute on function public.get_invite_preview(text) to authenticated;
grant execute on function public.rotate_invite_code(uuid) to authenticated;
grant execute on function public.promote_idea_to_plan(uuid) to authenticated;
grant execute on function public.promote_create_to_plan(uuid) to authenticated;

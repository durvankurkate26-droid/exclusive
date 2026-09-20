-- ===========================================================================
-- EXCLUSIVE — 0002 Row Level Security
--
-- The rule, everywhere: you can read and write a row only if you are a member of the
-- group it belongs to. Typing another group's UUID into the URL must return nothing,
-- not a forbidden page — the data should not exist as far as that session is
-- concerned.
--
-- Two patterns repeat:
--   USING        controls what you can see / change  (applies to select, update, delete)
--   WITH CHECK   controls what the row may look like after your write
--
-- Every insert policy that writes a user id pins it to auth.uid(). Without that, a
-- member could post a message, cast a vote or RSVP as somebody else — they are in the
-- group, so a membership-only check would happily allow it.
-- ===========================================================================

alter table public.profiles          enable row level security;
alter table public.groups            enable row level security;
alter table public.group_members     enable row level security;
alter table public.teas              enable row level security;
alter table public.tea_messages      enable row level security;
alter table public.tea_reactions     enable row level security;
alter table public.one_day_ideas     enable row level security;
alter table public.one_day_interest  enable row level security;
alter table public.create_ideas      enable row level security;
alter table public.create_members    enable row level security;
alter table public.plans             enable row level security;
alter table public.plan_options      enable row level security;
alter table public.plan_votes        enable row level security;
alter table public.plan_members      enable row level security;
alter table public.memory_capsules   enable row level security;
alter table public.memory_media      enable row level security;
alter table public.memory_members    enable row level security;
alter table public.memory_notes      enable row level security;

-- ---------------------------------------------------------------- profiles

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    -- Yourself, or anyone who shares a group with you. Not "every authenticated
    -- user": this is a private product, and the member directory is group-scoped.
    id = auth.uid()
    or exists (
      select 1 from public.group_members gm
      where gm.user_id = profiles.id
        and gm.group_id in (select public.my_group_ids())
    )
  );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- No insert policy: rows are created by the handle_new_user trigger, which is
-- SECURITY DEFINER. No delete policy: profiles die with their auth.users row.

-- ---------------------------------------------------------------- groups

drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups
  for select using (public.is_group_member(id));

drop policy if exists groups_insert on public.groups;
create policy groups_insert on public.groups
  for insert with check (created_by = auth.uid());

drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups
  for update using (public.is_group_admin(id)) with check (public.is_group_admin(id));

drop policy if exists groups_delete on public.groups;
create policy groups_delete on public.groups
  for delete using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = groups.id and gm.user_id = auth.uid() and gm.role = 'owner'
    )
  );

-- ---------------------------------------------------------------- group_members

drop policy if exists group_members_select on public.group_members;
create policy group_members_select on public.group_members
  for select using (public.is_group_member(group_id));

/*
 * Insert covers exactly one case: creating a group and adding yourself as its first
 * member. Joining someone else's group goes through join_group_by_code(), which is
 * SECURITY DEFINER — a would-be member cannot even see the target group, so they
 * could not satisfy a membership-based policy anyway.
 */
drop policy if exists group_members_insert_self on public.group_members;
create policy group_members_insert_self on public.group_members
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.groups g
      where g.id = group_id and g.created_by = auth.uid()
    )
  );

drop policy if exists group_members_update on public.group_members;
create policy group_members_update on public.group_members
  for update using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));

drop policy if exists group_members_delete on public.group_members;
create policy group_members_delete on public.group_members
  for delete using (
    -- Leave on your own, or be removed by an admin. An owner cannot be removed;
    -- ownership has to be transferred or the group deleted.
    (user_id = auth.uid() and role <> 'owner')
    or (public.is_group_admin(group_id) and role <> 'owner')
  );

-- ---------------------------------------------------------------- TEA

drop policy if exists teas_select on public.teas;
create policy teas_select on public.teas for select using (public.is_group_member(group_id));

drop policy if exists teas_insert on public.teas;
create policy teas_insert on public.teas
  for insert with check (public.is_group_member(group_id) and created_by = auth.uid());

drop policy if exists teas_update on public.teas;
create policy teas_update on public.teas
  for update using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));

drop policy if exists teas_delete on public.teas;
create policy teas_delete on public.teas
  for delete using (created_by = auth.uid() or public.is_group_admin(group_id));

drop policy if exists tea_messages_select on public.tea_messages;
create policy tea_messages_select on public.tea_messages
  for select using (public.can_access_tea(tea_id));

drop policy if exists tea_messages_insert on public.tea_messages;
create policy tea_messages_insert on public.tea_messages
  for insert with check (public.can_access_tea(tea_id) and user_id = auth.uid());

drop policy if exists tea_messages_update on public.tea_messages;
create policy tea_messages_update on public.tea_messages
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists tea_messages_delete on public.tea_messages;
create policy tea_messages_delete on public.tea_messages
  for delete using (user_id = auth.uid());

drop policy if exists tea_reactions_select on public.tea_reactions;
create policy tea_reactions_select on public.tea_reactions
  for select using (public.can_access_tea_message(message_id));

drop policy if exists tea_reactions_insert on public.tea_reactions;
create policy tea_reactions_insert on public.tea_reactions
  for insert with check (public.can_access_tea_message(message_id) and user_id = auth.uid());

drop policy if exists tea_reactions_delete on public.tea_reactions;
create policy tea_reactions_delete on public.tea_reactions
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------- ONE DAY

drop policy if exists ideas_select on public.one_day_ideas;
create policy ideas_select on public.one_day_ideas
  for select using (public.is_group_member(group_id));

drop policy if exists ideas_insert on public.one_day_ideas;
create policy ideas_insert on public.one_day_ideas
  for insert with check (public.is_group_member(group_id) and created_by = auth.uid());

drop policy if exists ideas_update on public.one_day_ideas;
create policy ideas_update on public.one_day_ideas
  for update using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));

drop policy if exists ideas_delete on public.one_day_ideas;
create policy ideas_delete on public.one_day_ideas
  for delete using (created_by = auth.uid() or public.is_group_admin(group_id));

drop policy if exists interest_select on public.one_day_interest;
create policy interest_select on public.one_day_interest
  for select using (public.can_access_idea(idea_id));

drop policy if exists interest_write on public.one_day_interest;
create policy interest_write on public.one_day_interest
  for insert with check (public.can_access_idea(idea_id) and user_id = auth.uid());

drop policy if exists interest_update on public.one_day_interest;
create policy interest_update on public.one_day_interest
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists interest_delete on public.one_day_interest;
create policy interest_delete on public.one_day_interest
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------- CREATE

drop policy if exists creates_select on public.create_ideas;
create policy creates_select on public.create_ideas
  for select using (public.is_group_member(group_id));

drop policy if exists creates_insert on public.create_ideas;
create policy creates_insert on public.create_ideas
  for insert with check (public.is_group_member(group_id) and created_by = auth.uid());

drop policy if exists creates_update on public.create_ideas;
create policy creates_update on public.create_ideas
  for update using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));

drop policy if exists creates_delete on public.create_ideas;
create policy creates_delete on public.create_ideas
  for delete using (created_by = auth.uid() or public.is_group_admin(group_id));

drop policy if exists create_members_select on public.create_members;
create policy create_members_select on public.create_members
  for select using (public.can_access_create(create_id));

drop policy if exists create_members_insert on public.create_members;
create policy create_members_insert on public.create_members
  for insert with check (public.can_access_create(create_id) and user_id = auth.uid());

drop policy if exists create_members_update on public.create_members;
create policy create_members_update on public.create_members
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists create_members_delete on public.create_members;
create policy create_members_delete on public.create_members
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------- ALIGN

drop policy if exists plans_select on public.plans;
create policy plans_select on public.plans for select using (public.is_group_member(group_id));

drop policy if exists plans_insert on public.plans;
create policy plans_insert on public.plans
  for insert with check (public.is_group_member(group_id) and created_by = auth.uid());

drop policy if exists plans_update on public.plans;
create policy plans_update on public.plans
  for update using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));

drop policy if exists plans_delete on public.plans;
create policy plans_delete on public.plans
  for delete using (created_by = auth.uid() or public.is_group_admin(group_id));

drop policy if exists plan_options_select on public.plan_options;
create policy plan_options_select on public.plan_options
  for select using (public.can_access_plan(plan_id));

drop policy if exists plan_options_insert on public.plan_options;
create policy plan_options_insert on public.plan_options
  for insert with check (public.can_access_plan(plan_id) and created_by = auth.uid());

drop policy if exists plan_options_delete on public.plan_options;
create policy plan_options_delete on public.plan_options
  for delete using (created_by = auth.uid());

drop policy if exists plan_votes_select on public.plan_votes;
create policy plan_votes_select on public.plan_votes
  for select using (public.can_access_plan_option(option_id));

drop policy if exists plan_votes_insert on public.plan_votes;
create policy plan_votes_insert on public.plan_votes
  for insert with check (public.can_access_plan_option(option_id) and user_id = auth.uid());

drop policy if exists plan_votes_delete on public.plan_votes;
create policy plan_votes_delete on public.plan_votes
  for delete using (user_id = auth.uid());

drop policy if exists plan_members_select on public.plan_members;
create policy plan_members_select on public.plan_members
  for select using (public.can_access_plan(plan_id));

drop policy if exists plan_members_insert on public.plan_members;
create policy plan_members_insert on public.plan_members
  for insert with check (public.can_access_plan(plan_id) and user_id = auth.uid());

drop policy if exists plan_members_update on public.plan_members;
create policy plan_members_update on public.plan_members
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists plan_members_delete on public.plan_members;
create policy plan_members_delete on public.plan_members
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------- VAULT

drop policy if exists capsules_select on public.memory_capsules;
create policy capsules_select on public.memory_capsules
  for select using (public.is_group_member(group_id));

drop policy if exists capsules_insert on public.memory_capsules;
create policy capsules_insert on public.memory_capsules
  for insert with check (public.is_group_member(group_id) and created_by = auth.uid());

drop policy if exists capsules_update on public.memory_capsules;
create policy capsules_update on public.memory_capsules
  for update using (public.is_group_member(group_id)) with check (public.is_group_member(group_id));

drop policy if exists capsules_delete on public.memory_capsules;
create policy capsules_delete on public.memory_capsules
  for delete using (created_by = auth.uid() or public.is_group_admin(group_id));

drop policy if exists memory_media_select on public.memory_media;
create policy memory_media_select on public.memory_media
  for select using (public.can_access_capsule(capsule_id));

drop policy if exists memory_media_insert on public.memory_media;
create policy memory_media_insert on public.memory_media
  for insert with check (public.can_access_capsule(capsule_id) and uploaded_by = auth.uid());

drop policy if exists memory_media_update on public.memory_media;
create policy memory_media_update on public.memory_media
  for update using (public.can_access_capsule(capsule_id)) with check (public.can_access_capsule(capsule_id));

drop policy if exists memory_media_delete on public.memory_media;
create policy memory_media_delete on public.memory_media
  for delete using (uploaded_by = auth.uid());

drop policy if exists memory_members_select on public.memory_members;
create policy memory_members_select on public.memory_members
  for select using (public.can_access_capsule(capsule_id));

drop policy if exists memory_members_write on public.memory_members;
create policy memory_members_write on public.memory_members
  for insert with check (public.can_access_capsule(capsule_id));

drop policy if exists memory_members_delete on public.memory_members;
create policy memory_members_delete on public.memory_members
  for delete using (public.can_access_capsule(capsule_id));

drop policy if exists memory_notes_select on public.memory_notes;
create policy memory_notes_select on public.memory_notes
  for select using (public.can_access_capsule(capsule_id));

drop policy if exists memory_notes_insert on public.memory_notes;
create policy memory_notes_insert on public.memory_notes
  for insert with check (public.can_access_capsule(capsule_id) and user_id = auth.uid());

drop policy if exists memory_notes_delete on public.memory_notes;
create policy memory_notes_delete on public.memory_notes
  for delete using (user_id = auth.uid());

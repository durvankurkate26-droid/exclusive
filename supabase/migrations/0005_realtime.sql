-- ===========================================================================
-- EXCLUSIVE — 0005 realtime
--
-- TEA's conversation is live: `components/tea/TeaRoom.tsx` subscribes to INSERTs on
-- `tea_messages`. That subscription silently delivers nothing unless the table is a
-- member of the `supabase_realtime` publication — no error, no warning, messages just
-- never arrive for anybody but the person who sent them.
--
-- It is in a migration rather than a dashboard checkbox because "works on my project,
-- silently broken on the fresh one" is exactly the failure a migration exists to stop.
--
-- RLS still applies to realtime: Supabase checks the subscriber's policies before
-- delivering a row, so a member of another group receives nothing. Turning a table on
-- here does not widen who can read it.
-- ===========================================================================

do $$
begin
  -- The publication exists on every Supabase project, but a bare `create` would fail
  -- on a plain Postgres one, and this repo is meant to be runnable against both.
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end
$$;

/*
 * `add table` errors if the table is already in the publication, which would break
 * re-running migrations. Checking pg_publication_tables first keeps this idempotent.
 */
do $$
declare
  t text;
  live_tables constant text[] := array[
    'tea_messages',    -- the conversation itself
    'tea_reactions',   -- reactions land without a refresh
    'plan_votes',      -- ALIGN's ballots move while people are looking at them
    'plan_members',    -- and so does who is coming
    'one_day_interest' -- hands going up on the wall
  ];
begin
  foreach t in array live_tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;

/*
 * Realtime sends only the changed columns unless the table is set to REPLICA IDENTITY
 * FULL. TeaRoom re-fetches the author by `user_id` from the payload, so DEFAULT is
 * enough for INSERTs — but a DELETE payload carries only the primary key, which is
 * why reactions disappearing needs the full row. Cheap at this scale.
 */
alter table public.tea_reactions replica identity full;
alter table public.plan_votes replica identity full;
alter table public.one_day_interest replica identity full;

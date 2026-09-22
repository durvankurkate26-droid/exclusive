-- ===========================================================================
-- 0006 — CREATE gets an ending.
--
-- A creation's lifecycle ends in "posted", and a posted thing lives somewhere: the
-- reel, the video, the album. `result_url` holds that link so the studio can show
-- the finished work next to the reference that started it.
--
-- Additive and nullable: existing rows are untouched, existing RLS policies on
-- create_ideas (select/update for group members) already cover the new column, and
-- re-running is a no-op.
-- ===========================================================================

alter table public.create_ideas
  add column if not exists result_url text;

alter table public.create_ideas
  drop constraint if exists create_ideas_result_url_http;

alter table public.create_ideas
  add constraint create_ideas_result_url_http
  check (result_url is null or result_url ~* '^https?://');

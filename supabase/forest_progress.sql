-- Run this once in the Supabase SQL Editor.
-- Per-user progress for "숲속 길잇기". There's no login, so each browser sends a
-- stable anonymous id (kept in localStorage; see src/lib/supabase.js -> getUserId).
-- We store which stages that id has cleared so a returning player resumes right
-- after their last cleared stage.
--
-- The table is locked down (RLS on, no policies); the anon client only touches
-- it through the two SECURITY DEFINER RPCs below — same pattern as the global
-- clear-counter functions in increment_snake_clear.sql.

create table if not exists public.forest_progress (
  user_id     text primary key,
  cleared     int[]       not null default '{}',
  max_cleared int         not null default 0,
  updated_at  timestamptz not null default now()
);

alter table public.forest_progress enable row level security;
-- (intentionally no policies: all access goes through the definer functions)


-- Record one cleared stage for a user. Idempotent: re-clearing a stage keeps the
-- set deduped and only ever grows max_cleared.
create or replace function public.save_forest_progress(uid text, level int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if uid is null or level is null then
    return;
  end if;

  insert into public.forest_progress as fp (user_id, cleared, max_cleared, updated_at)
  values (uid, array[level], level, now())
  on conflict (user_id) do update set
    cleared = (
      select array_agg(distinct v order by v)
      from unnest(fp.cleared || excluded.cleared) as t(v)
    ),
    max_cleared = greatest(fp.max_cleared, excluded.max_cleared),
    updated_at = now();
end;
$$;

grant execute on function public.save_forest_progress(text, int) to anon, authenticated;


-- Read a user's cleared stage ids (sorted). Returns NULL when the user has no
-- row yet; the client treats that as "no progress".
create or replace function public.get_forest_progress(uid text)
returns int[]
language sql
security definer
set search_path = public
stable
as $$
  select cleared from public.forest_progress where user_id = uid;
$$;

grant execute on function public.get_forest_progress(text) to anon, authenticated;

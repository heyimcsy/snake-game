-- Run this once in the Supabase SQL Editor.
-- Atomically bumps the global clear counter for a milestone level
-- (3/6/10/15/20/25/30, then every 5: 35/40/…/90) in the single-row
-- "snake-game" table. SECURITY DEFINER lets the anon client call it via rpc()
-- without opening the table up to public UPDATEs.
--
-- The milestone columns must exist on the table. If you add them yourself in the
-- Supabase UI you can skip the ALTER below; it's included so this file is
-- self-contained and safe to re-run (IF NOT EXISTS makes it idempotent).

alter table "snake-game"
  add column if not exists count_3  int default 0,
  add column if not exists count_6  int default 0,
  add column if not exists count_10 int default 0,
  add column if not exists count_15 int default 0,
  add column if not exists count_20 int default 0,
  add column if not exists count_25 int default 0,
  add column if not exists count_30 int default 0,
  add column if not exists count_35 int default 0,
  add column if not exists count_40 int default 0,
  add column if not exists count_45 int default 0,
  add column if not exists count_50 int default 0,
  add column if not exists count_55 int default 0,
  add column if not exists count_60 int default 0,
  add column if not exists count_65 int default 0,
  add column if not exists count_70 int default 0,
  add column if not exists count_75 int default 0,
  add column if not exists count_80 int default 0,
  add column if not exists count_85 int default 0,
  add column if not exists count_90 int default 0;

create or replace function public.increment_snake_clear(level int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- make sure the single global row exists
  insert into "snake-game" (
    count_3, count_6, count_10, count_15, count_20, count_25, count_30,
    count_35, count_40, count_45, count_50, count_55, count_60,
    count_65, count_70, count_75, count_80, count_85, count_90
  )
  select 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
  where not exists (select 1 from "snake-game");

  -- bump only the matching milestone column. Target the single row by its
  -- ctid via a subquery: a real, non-foldable qual that satisfies Supabase's
  -- "UPDATE requires a WHERE clause" safeguard (a plain `where true`/`ctid is
  -- not null` gets optimized away and is rejected).
  update "snake-game" set
    count_3  = coalesce(count_3, 0)  + (level = 3)::int,
    count_6  = coalesce(count_6, 0)  + (level = 6)::int,
    count_10 = coalesce(count_10, 0) + (level = 10)::int,
    count_15 = coalesce(count_15, 0) + (level = 15)::int,
    count_20 = coalesce(count_20, 0) + (level = 20)::int,
    count_25 = coalesce(count_25, 0) + (level = 25)::int,
    count_30 = coalesce(count_30, 0) + (level = 30)::int,
    count_35 = coalesce(count_35, 0) + (level = 35)::int,
    count_40 = coalesce(count_40, 0) + (level = 40)::int,
    count_45 = coalesce(count_45, 0) + (level = 45)::int,
    count_50 = coalesce(count_50, 0) + (level = 50)::int,
    count_55 = coalesce(count_55, 0) + (level = 55)::int,
    count_60 = coalesce(count_60, 0) + (level = 60)::int,
    count_65 = coalesce(count_65, 0) + (level = 65)::int,
    count_70 = coalesce(count_70, 0) + (level = 70)::int,
    count_75 = coalesce(count_75, 0) + (level = 75)::int,
    count_80 = coalesce(count_80, 0) + (level = 80)::int,
    count_85 = coalesce(count_85, 0) + (level = 85)::int,
    count_90 = coalesce(count_90, 0) + (level = 90)::int
  where ctid = (select ctid from "snake-game" limit 1);
end;
$$;

grant execute on function public.increment_snake_clear(int) to anon, authenticated;


-- Read the current clear count for a milestone level. SECURITY DEFINER so the
-- anon client can read the count via rpc() without a SELECT policy on the table.
create or replace function public.get_snake_clear_count(level int)
returns int
language sql
security definer
set search_path = public
stable
as $$
  select case level
    when 3  then count_3
    when 6  then count_6
    when 10 then count_10
    when 15 then count_15
    when 20 then count_20
    when 25 then count_25
    when 30 then count_30
    when 35 then count_35
    when 40 then count_40
    when 45 then count_45
    when 50 then count_50
    when 55 then count_55
    when 60 then count_60
    when 65 then count_65
    when 70 then count_70
    when 75 then count_75
    when 80 then count_80
    when 85 then count_85
    when 90 then count_90
    else null
  end
  from "snake-game"
  limit 1;
$$;

grant execute on function public.get_snake_clear_count(int) to anon, authenticated;


-- One-time backfill: newly added columns start as NULL on the existing global
-- row, which would hide the "N cleared" line until the first clear. Set them to
-- 0 so the count shows from the start. Safe to re-run (coalesce is idempotent).
update "snake-game" set
  count_20 = coalesce(count_20, 0),
  count_25 = coalesce(count_25, 0),
  count_30 = coalesce(count_30, 0),
  count_35 = coalesce(count_35, 0),
  count_40 = coalesce(count_40, 0),
  count_45 = coalesce(count_45, 0),
  count_50 = coalesce(count_50, 0),
  count_55 = coalesce(count_55, 0),
  count_60 = coalesce(count_60, 0),
  count_65 = coalesce(count_65, 0),
  count_70 = coalesce(count_70, 0),
  count_75 = coalesce(count_75, 0),
  count_80 = coalesce(count_80, 0),
  count_85 = coalesce(count_85, 0),
  count_90 = coalesce(count_90, 0)
where ctid = (select ctid from "snake-game" limit 1);

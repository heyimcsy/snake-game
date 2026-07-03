-- Run this once in the Supabase SQL Editor.
-- Atomically bumps the global clear counter for a milestone level (3/6/10/15)
-- in the single-row "snake-game" table. SECURITY DEFINER lets the anon client
-- call it via rpc() without opening the table up to public UPDATEs.

create or replace function public.increment_snake_clear(level int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- make sure the single global row exists
  insert into "snake-game" (count_3, count_6, count_10, count_15)
  select 0, 0, 0, 0
  where not exists (select 1 from "snake-game");

  -- bump only the matching milestone column. Target the single row by its
  -- ctid via a subquery: a real, non-foldable qual that satisfies Supabase's
  -- "UPDATE requires a WHERE clause" safeguard (a plain `where true`/`ctid is
  -- not null` gets optimized away and is rejected).
  update "snake-game" set
    count_3  = coalesce(count_3, 0)  + (level = 3)::int,
    count_6  = coalesce(count_6, 0)  + (level = 6)::int,
    count_10 = coalesce(count_10, 0) + (level = 10)::int,
    count_15 = coalesce(count_15, 0) + (level = 15)::int
  where ctid = (select ctid from "snake-game" limit 1);
end;
$$;

grant execute on function public.increment_snake_clear(int) to anon, authenticated;


-- Read the current clear count for a milestone level (3/6/10/15).
-- SECURITY DEFINER so the anon client can read the count via rpc() without a
-- SELECT policy on the table.
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
    else null
  end
  from "snake-game"
  limit 1;
$$;

grant execute on function public.get_snake_clear_count(int) to anon, authenticated;

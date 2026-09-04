-- tin — 0006: drop the orphaned tasks.group_name column
--
-- `group_name` is live in the production database but exists in no migration
-- and is read by no code. It came from an abandoned first pass at groups: a
-- 0002_task_groups.sql that was applied to the project and then deleted from
-- the repo in 411022d as an orphan, leaving the column behind. Groups shipped
-- later on a different design (`is_group` + parent_id, 0005), so nothing will
-- ever want this column.
--
-- The effect is that the database and supabase/migrations/ disagree: rebuilding
-- from migrations produces a schema without the column, while production has
-- it. `supabase gen types` is what surfaced it — the generated types carried a
-- field the app had no business using.
--
-- Two cases have to both work, because this migration is replayed anywhere the
-- history is applied from scratch:
--   * production, where the column exists and gets dropped;
--   * a fresh database (a rebuild, or a local `db reset`), where the column was
--     never created and this must be a harmless no-op — hence `if exists`.

do $$
declare
  stragglers bigint;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tasks'
      and column_name = 'group_name'
  ) then
    raise notice 'tasks.group_name is not present — nothing to drop';
    return;
  end if;

  -- Dropping a column throws its data away, and the column was never readable
  -- through the Data API without a session, so "it's empty" could only be
  -- assumed, not checked, from outside. Check it here where RLS doesn't apply
  -- and fail loudly if the assumption is wrong: a failed migration is
  -- recoverable, a silently deleted column isn't.
  --
  -- EXECUTE rather than a plain SELECT: plpgsql parses statement bodies when
  -- the block runs, so a direct reference to a column that doesn't exist would
  -- fail before the guard above could return.
  execute 'select count(*) from public.tasks where group_name is not null'
    into stragglers;

  if stragglers > 0 then
    raise exception
      'refusing to drop tasks.group_name: % row(s) still carry a value', stragglers;
  end if;
end;
$$;

-- Column-level grants are dropped along with the column; nothing to revoke.
alter table public.tasks drop column if exists group_name;

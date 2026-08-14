-- tin — backlog groups
-- An optional label that buckets one-off tasks in the Backlog screen
-- ("Things to buy", "Apartment fixes").
--
-- Free text on the task rather than its own table: a group exists exactly as
-- long as some task carries the name, so there are no empty groups to clean up,
-- renaming is a single update, and sharing/RLS come from the task's space.
-- Groups are scoped per space — the same name in two spaces is two groups.

alter table public.tasks
  add column if not exists group_name text
  check (group_name is null or btrim(group_name) <> '');

-- New columns aren't covered by the column-level grants in 0001, and without
-- them the Data API rejects writes to the column.
grant insert (group_name) on public.tasks to authenticated;
grant update (group_name) on public.tasks to authenticated;

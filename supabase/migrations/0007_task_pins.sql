-- tin — 0007: pinning a one-off to Up next
--
-- The home list runs from "now" to "someday": Up next, Coming up, Backlog,
-- Done. Dates place most things on their own — a chore by its interval, a
-- deadline by its due_on — but "I've decided this one is pressing" is a
-- choice, not a date, so it has to be stored. Like sort_order (0002), due_on
-- (0004) and is_group (0005) it's an explicit user-set attribute, not derived
-- state: the completion log still decides done, and logging a pinned task
-- leaves the pin alone, so an undo puts it straight back in Up next.
--
-- A timestamp rather than a boolean: undated pins line up in the order they
-- were pinned, and pinning never touches sort_order, so unpinning puts an item
-- back exactly where it sat in the hand-sorted backlog.
--
-- Top-level, non-group one-offs only. A recurring task comes up on its own
-- clock; a subtask belongs to its parent's card (the reason 0004 keeps
-- deadlines off them); a group never finishes, so a pin on one could never be
-- worked off. A CHECK rather than a trigger: every condition is on the row.

alter table public.tasks
  add column pinned_at timestamptz,
  add constraint pin_is_top_level_oneoff
    check (pinned_at is null or (kind = 'oneoff' and parent_id is null and not is_group));

-- column-level grants are additive: clients may pin and unpin
grant insert (pinned_at) on public.tasks to authenticated;
grant update (pinned_at) on public.tasks to authenticated;

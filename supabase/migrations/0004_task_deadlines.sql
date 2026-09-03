-- tin — 0004: deadlines on backlog items
--
-- A one-off can carry a due_on date: "renew the passport by the 12th". Like
-- sort_order in 0002 this is an explicit user-set attribute, not something
-- derived — the completion log still decides whether the task is done, the
-- date only says when doing it starts to matter.
--
-- Recurring tasks keep their elapsed-time interval and never take a deadline:
-- the two answer different questions and mixing them would make "due" mean two
-- things on the same row. Subtasks are ruled out too — a dated subtask would
-- surface on the Due screen detached from the item it belongs to.

alter table public.tasks
  add column due_on date,
  add constraint deadline_is_top_level_oneoff
    check (due_on is null or (kind = 'oneoff' and parent_id is null));

-- column-level grants are additive: clients may set and clear a deadline
grant insert (due_on) on public.tasks to authenticated;
grant update (due_on) on public.tasks to authenticated;

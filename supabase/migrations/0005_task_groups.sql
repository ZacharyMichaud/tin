-- tin — 0005: groups on the backlog
--
-- A group is a bucket you keep refilling ("Things to buy"), not a task that
-- finishes. That is the whole difference from the checklists in 0003: same
-- parent/child rows, same completions, same RLS, same realtime — only the
-- roll-up changes. A checklist parent goes to Done once every child is ticked;
-- a group never counts as done however many of its items are ticked, so it
-- keeps its place on the backlog and you go on adding to it.
--
-- Nothing new is stored about state, in keeping with the rest of the app:
-- ticking an item inserts an ordinary completion, so "who bought the dish
-- soap", backdating and undo all work untouched, and "which items are still
-- open" is recomputed from the log at read time.

alter table public.tasks
  add column is_group boolean not null default false;

-- Groups are top-level backlog buckets: never recurring (a bucket has no
-- cadence to schedule), and never nested inside another task (one level deep,
-- same rule as 0003).
--
-- Deliberately its own trigger rather than an edit to validate_subtask(): the
-- two sets of rules are independent, and keeping them apart means neither
-- migration has to re-state the other's checks to change its own.
create or replace function public.validate_group()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.is_group then
    if new.kind <> 'oneoff' then
      raise exception 'only one-off tasks can be groups';
    end if;
    if new.parent_id is not null then
      raise exception 'a group cannot sit inside another task';
    end if;
  end if;
  return new;
end;
$$;

create trigger tasks_validate_group
  before insert or update on public.tasks
  for each row execute function public.validate_group();

-- ── grants ─────────────────────────────────────────────────────────────
-- Additive, like every migration since 0001: new columns are invisible to the
-- Data API until the querying role is granted them explicitly.

grant insert (is_group) on public.tasks to authenticated;
grant update (is_group) on public.tasks to authenticated;

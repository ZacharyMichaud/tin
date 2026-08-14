-- tin — 0002: manual ordering for backlog tasks.
--
-- Backlog rows get dragged into whatever order the user wants, so position has
-- to be stored (task *state* is still derived from the completion log — this is
-- an explicit user-set attribute, not derivable from anything).
--
-- sort_order is a sparse double used as a fractional index: a drop writes the
-- midpoint of the row's two new neighbours, so one reorder is one UPDATE.
-- Ties break on created_at desc, which is the order the app used before this.
-- Only the backlog reads it; the due list still sorts by urgency.

alter table public.tasks
  add column sort_order double precision not null default 0;

-- keep the current arrangement (newest first) as the starting order
update public.tasks t
set sort_order = r.rn
from (
  select id, row_number() over (order by created_at desc) as rn
  from public.tasks
) r
where r.id = t.id;

create index tasks_sort_idx on public.tasks (space_id, sort_order);

-- column-level grants are additive: clients may set and move sort_order
grant insert (sort_order) on public.tasks to authenticated;
grant update (sort_order) on public.tasks to authenticated;

-- tin — subtasks on backlog items
--
-- A subtask is just a one-off task with a parent, so completions, undo,
-- backdating, "who did it", RLS and realtime all keep working untouched.
-- Nothing new is stored about state: a parent counts as done when it has its
-- own completion, or when every one of its subtasks has one.
--
-- Checklist order reuses sort_order from 0002 rather than adding a second
-- ordering column — subtasks are ordered among their siblings, and they never
-- appear in the top-level list, so the two uses can't collide.

alter table public.tasks
  add column parent_id uuid references public.tasks(id) on delete cascade;

create index tasks_parent_idx on public.tasks (parent_id, sort_order)
  where parent_id is not null;

-- One level of nesting, same space, backlog only. Cheap to enforce here, and
-- it stops a client bug from writing a tree the UI can't render.
create or replace function public.validate_subtask()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  parent public.tasks;
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'a task cannot be its own parent';
    end if;
    if new.kind <> 'oneoff' then
      raise exception 'only one-off tasks can be subtasks';
    end if;

    select * into parent from public.tasks where id = new.parent_id;
    if not found then
      raise exception 'parent task not found';
    end if;
    if parent.parent_id is not null then
      raise exception 'subtasks cannot be nested more than one level deep';
    end if;
    if parent.kind <> 'oneoff' then
      raise exception 'only backlog tasks can have subtasks';
    end if;
    if parent.space_id <> new.space_id then
      raise exception 'a subtask must live in its parent''s space';
    end if;
    if exists (select 1 from public.tasks where parent_id = new.id) then
      raise exception 'a task with subtasks cannot itself become a subtask';
    end if;
  end if;

  -- the other direction: a parent stays a one-off for as long as it has children
  if tg_op = 'UPDATE' and new.kind <> 'oneoff'
     and exists (select 1 from public.tasks where parent_id = new.id) then
    raise exception 'a task with subtasks must stay a one-off';
  end if;

  return new;
end;
$$;

create trigger tasks_validate_subtask
  before insert or update on public.tasks
  for each row execute function public.validate_subtask();

-- ── grants ─────────────────────────────────────────────────────────────
-- Additive: the column lists from 0001/0002 stay in place. created_by and
-- done_by remain server-controlled.

grant insert (parent_id) on public.tasks to authenticated;
grant update (parent_id) on public.tasks to authenticated;

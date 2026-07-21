-- tin — shared chore + backlog tracker
-- Run in the Supabase SQL editor (or `supabase db push`).
-- Core idea: task state is computed from task_completions, never stored.

create extension if not exists pgcrypto;

-- ── tables ─────────────────────────────────────────────────────────────

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique default upper(left(encode(gen_random_bytes(8), 'hex'), 6)),
  is_personal boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- bootstrap races just fail the second insert
create unique index one_personal_space_per_user on public.spaces (created_by) where is_personal;

create table public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);
create index space_members_user_idx on public.space_members (user_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  title text not null,
  notes text,
  kind text not null check (kind in ('recurring', 'oneoff')),
  -- elapsed-time recurrence: due when (days since last completion) >= interval_days.
  -- null for one-offs. A future fixed-weekday mode adds columns; it doesn't change these.
  interval_days int check (interval_days >= 1),
  archived boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint recurring_needs_interval check (kind <> 'recurring' or interval_days is not null)
);
create index tasks_space_idx on public.tasks (space_id) where not archived;

create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  done_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- a calendar day, always chosen client-side in the user's timezone (backdatable)
  done_on date not null,
  created_at timestamptz not null default now()
);
create index task_completions_task_idx on public.task_completions (task_id, done_on desc);

-- ── helpers ────────────────────────────────────────────────────────────
-- security definer: policies on space_members can't query space_members
-- themselves (infinite RLS recursion), so membership checks go through these.

create or replace function public.is_space_member(sid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.space_members
    where space_id = sid and user_id = auth.uid()
  );
$$;

create or replace function public.can_access_task(tid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tasks t
    join public.space_members m on m.space_id = t.space_id
    where t.id = tid and m.user_id = auth.uid()
  );
$$;

-- creator auto-joins their new space
create or replace function public.handle_new_space()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  email text := nullif(current_setting('request.jwt.claims', true), '')::json ->> 'email';
begin
  insert into public.space_members (space_id, user_id, display_name)
  values (new.id, new.created_by, coalesce(split_part(email, '@', 1), 'me'));
  return new;
end;
$$;

create trigger on_space_created
  after insert on public.spaces
  for each row execute function public.handle_new_space();

-- join a shared space by its 6-char code
create or replace function public.join_space(code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  sid uuid;
  email text := nullif(current_setting('request.jwt.claims', true), '')::json ->> 'email';
begin
  select id into sid from public.spaces
  where join_code = upper(trim(code)) and not is_personal;
  if sid is null then
    raise exception 'invalid join code';
  end if;
  insert into public.space_members (space_id, user_id, display_name)
  values (sid, auth.uid(), coalesce(split_part(email, '@', 1), 'member'))
  on conflict (space_id, user_id) do nothing;
  return sid;
end;
$$;

-- ── row level security ─────────────────────────────────────────────────

alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_completions enable row level security;

create policy "members read spaces" on public.spaces for select
  using (public.is_space_member(id) or created_by = auth.uid());
create policy "authed create spaces" on public.spaces for insert
  with check (created_by = auth.uid());
create policy "members rename spaces" on public.spaces for update
  using (public.is_space_member(id)) with check (public.is_space_member(id));
create policy "creator deletes space" on public.spaces for delete
  using (created_by = auth.uid());

-- no insert policy on space_members: rows are only created by the
-- security-definer paths (space trigger + join_space)
create policy "members read members" on public.space_members for select
  using (user_id = auth.uid() or public.is_space_member(space_id));
create policy "edit own membership" on public.space_members for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "leave space" on public.space_members for delete
  using (user_id = auth.uid());

create policy "members read tasks" on public.tasks for select
  using (public.is_space_member(space_id));
create policy "members create tasks" on public.tasks for insert
  with check (public.is_space_member(space_id) and created_by = auth.uid());
create policy "members edit tasks" on public.tasks for update
  using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));
create policy "members delete tasks" on public.tasks for delete
  using (public.is_space_member(space_id));

create policy "members read completions" on public.task_completions for select
  using (public.can_access_task(task_id));
create policy "members log completions" on public.task_completions for insert
  with check (public.can_access_task(task_id) and done_by = auth.uid());
create policy "undo own completions" on public.task_completions for delete
  using (done_by = auth.uid());

-- ── grants ─────────────────────────────────────────────────────────────
-- Without explicit grants the Data API 404s on new tables (learned on the
-- gym tracker). anon gets nothing: every query happens signed-in.
-- Column-level insert/update grants keep clients from touching
-- created_by / join_code / is_personal / done_by directly.

grant usage on schema public to authenticated;

grant select on public.spaces to authenticated;
grant insert (name, is_personal) on public.spaces to authenticated;
grant update (name) on public.spaces to authenticated;
grant delete on public.spaces to authenticated;

grant select on public.space_members to authenticated;
grant update (display_name) on public.space_members to authenticated;
grant delete on public.space_members to authenticated;

grant select on public.tasks to authenticated;
grant insert (id, space_id, title, notes, kind, interval_days) on public.tasks to authenticated;
grant update (title, notes, kind, interval_days, archived) on public.tasks to authenticated;
grant delete on public.tasks to authenticated;

grant select on public.task_completions to authenticated;
grant insert (id, task_id, done_on) on public.task_completions to authenticated;
grant delete on public.task_completions to authenticated;

grant execute on function public.is_space_member(uuid) to authenticated;
grant execute on function public.can_access_task(uuid) to authenticated;
grant execute on function public.join_space(text) to authenticated;

-- ── realtime ───────────────────────────────────────────────────────────
-- Lets the other phone in a shared space refresh live. RLS applies.

alter table public.spaces replica identity full;
alter table public.space_members replica identity full;
alter table public.tasks replica identity full;
alter table public.task_completions replica identity full;

alter publication supabase_realtime
  add table public.spaces, public.space_members, public.tasks, public.task_completions;

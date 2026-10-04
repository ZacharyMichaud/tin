# tin — Project Context

## What this is
A recurring-chores + backlog tracker PWA for me and a roommate/partner. The one question it answers: **"how many days ago did I last do this, and what's due?"** (cat fountain filter every 2 weeks, sheets every month, plus a backlog of one-time stuff). Mobile-first, one-tap logging, free to host. Not commercial — favor simplicity and shipping over generality. Sibling project to the gym tracker (`pousse de la fonte`), same stack and philosophy.

## Stack (decided, don't relitigate without asking)
- **Frontend:** React + Vite + TypeScript, PWA (installable), Tailwind v4, TanStack Query, React Router
- **Backend:** Supabase free tier (its **own** project, separate from the gym one) — Postgres, Auth (email OTP codes, not magic links), Row Level Security
- **Hosting:** Vercel free tier (`vercel.json` has the SPA rewrite)
- **No custom server.** All data access goes through the Supabase client with RLS enforcing per-space isolation.

## Core architectural principle
**Task state is computed from the completion log, never stored.** A `tasks` row defines the chore; `task_completions` records every time it was done, by whom, on what day. "Days since last done", due/overdue, per-task history, and cadence stats all derive from the log at read time. Marking done = inserting one completion row; undo = deleting it. Nothing else mutates.

## Recurrence model (decided)
**Elapsed-time intervals anchored to the last completion** — "due every N days after I actually last did it", not calendar schedules. Washing sheets 5 days late means the next wash is due N days from the late wash. `interval_days` on the task; due when `days_since_last >= interval_days`. Days are compared as **local calendar days** (`done_on` is a `date` chosen client-side), so "yesterday 11pm" is 1 day ago. A chore logged today is never amber, whatever its interval — otherwise a daily chore's one-day window would flag it the moment you did it.
(Fixed-day schedules like "trash every Tuesday" are a possible later addition as new columns — design nothing that blocks that, build none of it now.)

## Data model
Sharing works through **spaces**: every task belongs to a space, every space has members, and RLS scopes everything to spaces you're a member of. A personal space is auto-created on first login (`is_personal`); shared spaces are joined with a 6-char `join_code`.

- **spaces** — `id, name, join_code, is_personal, created_by, created_at`
- **space_members** — `space_id, user_id, display_name, joined_at` (display_name shown as "who did it")
- **tasks** — `id, space_id, title, notes, kind ('recurring'|'oneoff'), interval_days, due_on, sort_order, parent_id, is_group, pinned_at, archived, created_by, created_at`
  - One-offs have `interval_days null`; a one-off with any completion is "done". Same tap path as recurring.
  - `due_on` is an optional deadline on a top-level one-off (0004): the one thing an elapsed-time interval can't say. Recurring tasks and subtasks can't have one. It's a user-set attribute like `sort_order`, not derived state — the log still decides done.
  - `sort_order` is the hand-arranged backlog position (0002) — a sparse double used as a fractional index, so one drag is one UPDATE rather than a renumber.
  - `parent_id` makes a one-off a **subtask** of another one-off (0003, one level only, same space). Still nothing new stored about state: a checklist parent counts as done when it has its own completion, or when every subtask has one — untick one and it comes straight back out of Done.
  - `is_group` flips that roll-up (0005). A **group** is a bucket you keep refilling — "things to buy" — so it never counts as done however much you tick off it, and never leaves the backlog. Its items aren't steps of one job, they're ordinary one-offs filed together: tick one and it leaves the group to stand on its own in Done, where undo puts it back. Groups are always top-level one-offs, enforced by a trigger. **Checklist vs group is the whole distinction: one finishes, the other doesn't.**
  - `pinned_at` pins a one-off to **Up next** (0007): "I've decided this is pressing" is a choice, not a date, so it's stored — another user-set attribute, untouched by logging, so undoing a tick puts a pinned item straight back up next. A timestamp so undated pins line up oldest-first without borrowing `sort_order` (unpinning puts an item back exactly where it sat). A CHECK keeps it to top-level, non-group one-offs; the edit sheet clears it if a pinned one-off becomes recurring.
- **task_completions** — `id, task_id, done_by, done_on date, created_at` (grows forever; powers everything)

Supabase gotchas already baked into the migration (both learned on the gym tracker):
- **New tables 404 in the Data API until granted** to the querying role — migration has explicit grants (column-level for insert/update).
- RLS policies on `space_members` can't query `space_members` (infinite recursion) — membership checks go through `security definer` helpers (`is_space_member`, `can_access_task`). Membership rows are only ever created by definer paths (space-creation trigger, `join_space(code)` RPC).
- Email OTP login requires `{{ .Token }}` in the Supabase email template.

## Screens
**One home list, no tab bar.** Chores and one-offs from all my spaces share a single list (small space chip on shared tasks) that runs from now to someday. Manage sits behind the sliders icon in the header. Placement is one pure decision per row in `src/lib/home.ts` — never a filter per section, so nothing can fall between two of them.
1. **Home** (`/`; `/backlog` redirects here)
   - **Up next** — no label of its own; the heading ("6 things up next") is its title, with a dot line underneath splitting the count into overdue / today / new / soon / pinned. Holds anything late, due today, never logged, or due within `UP_NEXT_DAYS` (2) on its own clock, plus every pinned one-off. A deadline joins 2 days out; a chore joins at the smaller of that and its amber window (`isPressing`), so a 3-day plant chore isn't up next two days in three. Most urgent first; a pin decides *that* a row is up next, never how high, so a pinned dated item sorts by its date and an undated pin counts as today, oldest pin first. Checklists start expanded here. When empty the heading says "All caught up" and names what's next.
   - **Coming up** — every other chore, plus deadlines further out, soonest first. Every chore stays visible here (348a591). `DEADLINE_SOON_DAYS` (7) only decides when a deadline turns amber.
   - **Backlog** — undated, unpinned one-offs and groups, hand-sorted by dragging the grip on the row's leading edge.
   - **Done** — finished one-offs with undo, folded by default. The three lower sections fold, remembered per device.
   - Rows: the leading tile says why a row sits where it does — days-ago for a chore, a **days-left** countdown for a deadline, checklist progress, the pin for an undated pinned item, nothing for a plain backlog item — and the **done button is on the trailing edge of every row**, so it's in one column across every section and doesn't jump sides when something is pinned. A **group** is one collapsible card: an open-item count where the days badge would be (not a progress ring — a ring reads as progress towards finishing, and a bucket never finishes), no done button anywhere on it, and an inline "add an item" row. Ticked items leave the group and show up in Done tagged with the group they came from.
   - **Pinning** ("Pin to Up next" / "Unpin") lives on the add/edit sheet chip, the **Pin** action on the "Added to Backlog" snackbar, and the task page. Deliberately no row gesture yet: tap opens, the done button logs and backdates, the grip drags.
   - One FAB; the add sheet defaults to one-time and offers "Make a group instead".
2. **Manage** — spaces (create/join/rename, join code, members, my display name), archived tasks, account. Utilitarian is fine.
3. **Task detail** (`/task/:id`) — status, log-for-another-day, pin/unpin, edit/archive/delete, completion history, cadence stat ("usually every ~16d"). A group's page instead shows its Items list — ticked ones included, since that's where you go to un-tick one once the snackbar is gone — and drops the completion buttons and its own History, because a bucket has nothing to log.

## UX rules (non-negotiable)
- Logging a completion is **one tap on a ≥52px target**, optimistic (client-generated uuid), with an **Undo snackbar**. No confirm dialogs on the happy path.
- **"X days ago" is the hero number** everywhere; color encodes urgency (new / ok / soon / due / overdue).
- **Long-press the done button = backdate** ("I did it yesterday, forgot to log") — today/yesterday/2d/3d or a date picker. Also reachable from task detail.
- Adding a task takes ≤10 seconds: title + interval presets (3/7/14/30 or stepper), kind toggle, space chips. Everything else has defaults.
- Shared tasks show **who** last did it (display names from space_members; "you" for self).
- Supabase Realtime invalidates queries so a roommate's log shows up live. Full offline mutation queueing is **not** built yet (chores happen on home wifi) — candidate for later hardening.
- Demo mode (`?demo=1` or `VITE_DEMO=1`) fakes a session and seeds local data — UI is browsable with no backend; mutations are cache-only.

## Build order
1. Scaffold, schema + RLS migration, auth (email OTP) ✅
2. Vertical slice: personal-space bootstrap, task CRUD, done-tap, due list ✅
3. Backlog + backdating + undo ✅
4. Sharing: spaces UI, join codes, who-did-it, realtime ✅ (code written; needs a live Supabase project to verify end-to-end)
5. History + cadence stats on task detail ✅
6. PWA polish: manifest + icons + autoupdating SW ✅; offline sync hardening later if it ever hurts
7. One home list (Up next / Coming up / Backlog / Done) + pins, tab bar gone ✅

## Conventions
- TypeScript strict. Row shapes are **generated from the live database** into `src/lib/database.types.ts` (`npm run types:gen`, CLI pinned to match CI) — never edit it by hand. `src/lib/types.ts` is the thin curated layer over it, and exists for the two things `gen types` can't see: `kind` is `text` + CHECK rather than an enum so it generates as `string` (narrowed back to a union), and column grants decide what a client may write (so `TaskInsert`/`TaskUpdate` list only granted columns, making an ungranted write a type error instead of a runtime failure).
- Generated types are also the drift detector: on their first run they surfaced `group_name`, a column live in the database but in no migration — an orphan of the abandoned first pass at groups. Dropped in 0006, which is guarded so it refuses if any row carries a value and no-ops on a database that never had the column.
- Components small; server state lives in TanStack Query, no separate store.
- Migrations as SQL files in `supabase/migrations/`, committed.
- Mobile viewport first; test at 380px width.
- Icons regenerate with `npm run icons` (edit `public/icon.svg`, sharp rasterizes the PNGs).

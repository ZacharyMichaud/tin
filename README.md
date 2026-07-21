# tin

*when did I last…?*

A tiny PWA for recurring chores ("wash the cat fountain every 2 weeks") and a one-time backlog, shareable with a roommate/partner. The hero feature: every task shows **how many days ago you last did it** and turns amber/red as it comes due. Logging is one tap, with undo and backdating.

Recurring tasks use **elapsed intervals**: the clock resets when you actually do the thing, not on a calendar date. All state derives from an append-only completions log.

Try it without a backend: run the dev server and open `http://localhost:5173/?demo=1`.

## Setup (one time, ~10 minutes)

### 1. Create the Supabase project
1. [supabase.com](https://supabase.com) → New project (free tier). Name it `tin`.
2. SQL Editor → paste the whole contents of `supabase/migrations/0001_init.sql` → Run.
   (Or with the CLI: `supabase link --project-ref <ref>` then `supabase db push`.)

### 2. Configure auth (email codes)
1. Authentication → Sign In / Providers → Email: enabled (default). Turn **off** "Confirm email" double-opt-in if you want frictionless first login.
2. Authentication → Emails → **Magic Link** template: replace the body so it shows the code, e.g.
   ```html
   <h2>Your tin sign-in code</h2>
   <p style="font-size: 32px; letter-spacing: 4px;"><b>{{ .Token }}</b></p>
   ```
   Without `{{ .Token }}` the email contains no code and login is impossible.
3. Heads-up: Supabase's built-in mailer is limited to ~2 emails/hour. Fine for two people; if it bites, wire a free SMTP provider (Resend/Brevo) under Project Settings → Auth → SMTP.

### 3. Point the app at it
```sh
cp .env.example .env.local   # then fill in URL + anon key from Settings → API
npm install
npm run dev
```

### 4. Deploy (Vercel free tier)
Import the repo in Vercel — framework auto-detects as Vite; `vercel.json` already handles SPA rewrites. Add the two `VITE_*` env vars. Open the deployed URL on your phone → "Add to Home Screen".

### 5. Invite your roommate
They sign in with their email, you send them the 6-char invite code from **Manage → your shared space**, they tap **Join with code**. Tasks in that space show up for both of you, with "who did it last".

## Development notes
- DB types are hand-written in `src/lib/types.ts`; once the project exists you can regenerate with `npx supabase gen types typescript --project-id <ref> --schema public`.
- Icons: edit `public/icon.svg`, then `npm run icons`.
- Architecture and product rules live in `CLAUDE.md`.

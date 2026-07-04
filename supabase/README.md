# TogetherWealth — Supabase local development

Everything the app needs from the database lives here: schema, Row Level
Security, storage bucket, realtime publication, and a rich demo seed.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) running locally
- [Supabase CLI v2](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase`)

## Start the stack

From the project root:

```bash
supabase start
```

First run downloads the images, applies every migration in
`supabase/migrations/` in order, and runs `supabase/seed.sql`. When it
finishes, `supabase status` prints the local URLs and keys.

| Service  | URL                                       |
| -------- | ----------------------------------------- |
| API      | http://localhost:54321                    |
| Database | postgresql://postgres:postgres@localhost:54322/postgres |
| Studio   | http://localhost:54323                    |

## Wire up the Next.js app

Copy the values from `supabase status` into `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from `supabase status`>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from `supabase status`>
```

## Reset the database

Re-applies all migrations from scratch and re-runs the seed:

```bash
supabase db reset
```

Use this whenever a migration changes or the demo data gets messy.

## Demo logins

The seed creates a couple sharing the workspace **"Alex & Jamie"** (hybrid
money style, income-based default split, Plus plan), with ~3 months of
expenses, budgets, goals, investments, debts, research, a completed money
check-in, tasks, and activity history.

| Partner     | Email                          | Password            |
| ----------- | ------------------------------ | ------------------- |
| Alex Rivera | `alex@demo.togetherwealth.app` | `demo-password-123` |
| Jamie Chen  | `jamie@demo.togetherwealth.app`| `demo-password-123` |

Privacy features are seeded too — sign in as each partner to verify them:

- Jamie has a **private** income source (freelance), a private savings goal
  ("New laptop"), and a private expense (a birthday gift for Alex). None of
  these should ever appear for Alex, in lists or totals.
- Each partner has a private personal checking account.
- Last month's check-in answers are revealed for both partners; the current
  month's check-in is still a draft.

## Files

| File                             | Purpose                                                            |
| -------------------------------- | ------------------------------------------------------------------ |
| `config.toml`                    | Supabase CLI config (ports, auth redirect URLs, seed path)          |
| `migrations/00001_schema.sql`    | Enums, all 26 tables, indexes, `updated_at` + signup/workspace triggers |
| `migrations/00002_rls.sql`       | RLS policies (visibility model), `is_workspace_member`, `accept_partner_invite` |
| `migrations/00003_storage.sql`   | Private `documents` bucket + object policies (`{workspace_id}/{owner_id}/{filename}`) |
| `migrations/00004_realtime.sql`  | Adds collaborative tables to the `supabase_realtime` publication    |
| `seed.sql`                       | Demo users + workspace + ~3 months of coherent data                 |

## Notes & gotchas

- **Auth emails are auto-confirmed locally** (`enable_confirmations = false`
  in `config.toml`), so signup works without an email inbox.
- **Documents are metadata-only in the seed.** The three seeded rows point at
  storage paths that have no uploaded file behind them; downloading them will
  404 until you upload files at those paths. Uploads from the app work
  normally.
- **Subscriptions are service-role only.** Clients can read their workspace's
  subscription but never write it — plan changes must go through server code
  using `lib/supabase/admin.ts`.
- **Never edit an applied migration.** Add a new numbered file instead, or
  run `supabase db reset` after changing these while iterating locally.

# BrahmAstra Academy

The learning module of [brahmastra.studio](https://brahmastra.studio). Cinematic AI video
courses in Malayalam, taught around the same six-stage pipeline the studio runs on —
Prompt, World, Motion, Scene, Finish, Deliver.

Version 2 is a full rewrite of the original Next.js MVP onto the BrahmAstra stack and
design language:

- **apps/web** — React 19, React Router 7 data routers, Vite. The cinemastudio visual
  system: charcoal glass surfaces, letterbox scenes, a running REC timecode, the animated
  pipeline rail and line-art stage illustrations. Magenta is shared with BrahmAstra; ember
  is the Academy's own signal colour for everything about learning progress.
- **apps/server** — Express, Prisma, PostgreSQL. Cookie sessions with double-submit CSRF,
  the same pattern as BrahmAstra's `apps/server`.

```
apps/
  web/            React client (routes/, components/, styles/, ui/styles/ design tokens)
  server/         API (routes/, lib/), tests in test/
apps/web/worker/  Cloudflare Worker: serves the SPA, proxies /api to Render
render.yaml       Render Blueprint: Postgres + the API
prisma/           schema.prisma (shared) and seed.ts
scripts/          copy-database.ts — one-off move from the old Supabase database
supabase/         migration adding Academy columns to the shared `profiles` table
```

## Features

- Course catalogue, syllabus pages and a free first-lesson preview
- Classroom with sequential unlocks, lesson notes (Markdown, sanitised), project files,
  automatic progress tracking for uploaded videos and a manual "mark complete" for
  YouTube/Vimeo lessons
- Timestamped doubt threads with replies and likes — click a timestamp to scrub an
  uploaded lesson to that moment
- Per-course community wall: image or link posts, reactions, nested replies, latest/top
  sorting, lightbox and a leaderboard
- Enrolment through Razorpay Checkout, or manual UPI transfer reviewed by an admin who
  issues a one-time license code
- Gift a course: pay once, share a gift code, the recipient redeems it
- AI Studio: prepaid credit packs, image and video generation through the KIE provider,
  with automatic refunds when a job fails
- Notifications for replies, reactions, new posts and new lessons
- Admin workspace: overview, courses, lessons and resources, student CRM with grant and
  revoke, payment review, community moderation, the prompt library and AI Studio
  settings
- Sign in with Google (Google Identity Services, shared with BrahmAstra Studio), plus
  email/password and email magic links
- One session across `*.brahmastra.studio`; paid students land in their classroom,
  everyone else on the dashboard with the offer

## Setup

Requires Node 20+ and a PostgreSQL database (Supabase works as-is).

```bash
cp .env.example .env        # then fill in DATABASE_URL, DIRECT_URL and ADMIN_PASSWORD
npm install
npm run db:push             # create or update tables
npm run db:seed             # sample course, admin account, studio pricing
npm run dev                 # API on :8080, client on :5173
```

Open http://localhost:5173. Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` for the admin
workspace at `/admin`.

The client proxies `/api` and `/uploads` to the API in development. Everything optional
in `.env.example` degrades cleanly when unset: no Razorpay → manual UPI checkout only; no
SMTP → license codes are shown to the admin instead of emailed and magic links are hidden;
no Google keys → the Google button is hidden; no Supabase → uploads are written to
`apps/server/uploads`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API (tsx watch) and client (Vite) together |
| `npm run build` | Prisma client, server `tsc`, client typecheck + Vite build |
| `npm start` | Production server; also serves the built client on one origin |
| `npm run typecheck` | Both apps |
| `npm test` | Server tests (`node:test` via tsx) |
| `npm run db:push` / `db:migrate` / `db:seed` / `db:studio` | Prisma helpers |
| `npm run db:copy` | One-off copy from the old database (see Deploying) |
| `npm run preview:worker` (apps/web) | Build and serve through the Worker locally |
| `npm run deploy:worker` (apps/web) | Build and deploy the Worker to Cloudflare |
| `npm run cf-typegen` (apps/web) | Regenerate Worker binding types after editing `wrangler.jsonc` |

## Sign-in across brahmastra.studio

Google sign-in uses Google Identity Services with the **same OAuth client as BrahmAstra
Studio**, so one Google consent covers both products and One Tap can sign a returning
Studio user straight into the Academy.

1. The browser loads Google's SDK (`accounts.google.com/gsi/client`) and gets an ID token
   bound to a one-time nonce.
2. `POST /api/auth/google` verifies it with Google's `google-auth-library` (signature,
   audience, issuer, expiry), then checks the nonce and that the email is verified.
3. The account is matched on Google's stable `sub` first and email second, so existing
   paid students keep their purchases. A session cookie is set.
4. The person is mirrored into the shared Supabase project — an Auth user plus their
   `profiles` row, including `academy_access` — the same contract the Studio uses.
5. They land in the classroom of their most recent course if they paid, on `/admin` if
   they are an admin, and on `/dashboard` with the offer otherwise.

Multi-domain pieces, all driven by env: `COOKIE_DOMAIN=.brahmastra.studio` shares the
session across subdomains; `ALLOWED_ORIGINS` lets other brahmastra.studio frontends call
the API with credentials (e.g. `GET /api/auth/session` returns `access.member`).

**Google Cloud Console** — for client `706720560213-…`, add every origin that shows the
button under *Authorised JavaScript origins*: `https://academy.brahmastra.studio`, plus
`http://localhost:5173` and `http://localhost` for local development.

**Supabase** — run `supabase/migrations/20260922120000_academy_profiles.sql` on the shared
project to store Academy access on each profile. Without it, the mirror still writes the
name, avatar and sign-in time. `SUPABASE_SERVICE_ROLE_KEY` never leaves the API.

## Deploying

```
Browser ──> academy.brahmastra.studio  (Cloudflare Worker)
              ├─ /*          SPA from Workers Static Assets
              └─ /api/*      proxied ──> brahmastra-academy-api  (Render, Node)
                                            └─ brahmastra-academy-db  (Render Postgres)
```

The Worker keeps the browser on one origin, so cookies are first-party and the Academy
needs no CORS for itself. It forwards the visitor's IP with a shared secret so the API's
rate limits key on real people rather than Cloudflare's addresses.

### 1. Render — database and API

1. In Render, **New → Blueprint** and point it at this repo. `render.yaml` creates the
   Postgres database and the `brahmastra-academy-api` web service in Singapore.
2. Fill the prompted secrets: `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
   the Razorpay keys, SMTP and `KIE_API_KEY`. `PROXY_SHARED_SECRET` is generated for you.
3. The first deploy creates the tables (`preDeployCommand` runs `prisma db push`) and
   serves the API at `https://brahmastra-academy-api.onrender.com`.

### 2. Move the existing students across

Run once, into the new, still-empty database — before anyone signs in:

```bash
SOURCE_DATABASE_URL="<old Supabase direct URL>" \
TARGET_DATABASE_URL="<Render external URL>" \
npm run db:copy
```

The database only accepts private connections (`ipAllowList: []`), so either run this from
the API service's **Shell** in Render (use its `DATABASE_URL` as the target) or add your IP
to the database's allow list for the duration. It copies every table in dependency order,
keeps ids, prints source and target counts, and refuses a target that already has users.

### 3. Cloudflare — the web app

```bash
cd apps/web
npx wrangler secret put PROXY_SHARED_SECRET   # paste the value from Render
npm run deploy:worker
```

`wrangler.jsonc` binds the custom domain `academy.brahmastra.studio` (the zone must be on
the same Cloudflare account) and points `API_ORIGIN` at the Render service — update it if
Render assigns a different URL. Logs and traces are enabled.

To run the production topology locally: start the API, then `npm run preview:worker` in
`apps/web` with `API_ORIGIN` pointed at `http://127.0.0.1:8080`.

### Payments

In the Razorpay dashboard, add a webhook to `https://academy.brahmastra.studio/api/payments/razorpay-webhook`
with the secret in `RAZORPAY_WEBHOOK_SECRET`, subscribed to **`order.paid`** and
**`payment_link.paid`**. `order.paid` is what unlocks a student who paid but closed the tab
before Checkout could report back.

Every settlement path — Checkout's verify call and both webhooks — goes through
`apps/server/src/lib/settle.ts`, which flips a request from pending to approved with a
conditional update, so a race between them can never unlock twice, mint two gift codes or
credit a studio pack twice.

## Migrating from v1

The schema is unchanged; `npm run db:copy` (above) moves the data. Password accounts keep
their passwords. Google accounts from v1 were stored with Google's `sub`, so they match on
the first Google sign-in even if the address has since changed. Everyone signs in once
after the switch, since sessions and one-time tokens are not copied.

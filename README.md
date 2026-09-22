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
api/index.js      Vercel function entry — mounts the Express app
prisma/           schema.prisma (shared) and seed.ts
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
- Email/password, Google, and email magic-link sign-in

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

## Deploying

**Vercel.** `vercel.json` builds both apps, serves `apps/web/dist` as static files and
routes `/api/*` to the Express app through `api/index.js`. Add every variable from
`.env.example`, set `APP_URL` to your domain, and set `NODEJS_HELPERS=0` so Express reads
raw request bodies — the Razorpay webhook signature is computed over the exact bytes.
Uploads must go to Supabase storage on Vercel (the filesystem is read-only), and function
bodies are capped at 4.5 MB, so host lesson videos on YouTube, Vimeo or Supabase and paste
the URL.

**Any Node host** (Render, Railway, a VM): `npm run build && npm start`. One process serves
the API and the client.

### Payments

In the Razorpay dashboard, add a webhook to `https://<your-domain>/api/payments/razorpay-webhook`
with the secret in `RAZORPAY_WEBHOOK_SECRET`, subscribed to **`order.paid`** and
**`payment_link.paid`**. `order.paid` is what unlocks a student who paid but closed the tab
before Checkout could report back.

Every settlement path — Checkout's verify call and both webhooks — goes through
`apps/server/src/lib/settle.ts`, which flips a request from pending to approved with a
conditional update, so a race between them can never unlock twice, mint two gift codes or
credit a studio pack twice.

## Migrating from v1

The database schema is unchanged, so the existing Supabase database works without a
migration. Password accounts keep their passwords, and Google accounts reconnect by email
on their next Google sign-in. The v1 `Session` and `VerificationToken` tables are reused
for v2's hashed session and magic-link tokens; everyone signs in once after the switch.

Google OAuth needs a new authorised redirect URI: `${APP_URL}/api/auth/google/callback`.

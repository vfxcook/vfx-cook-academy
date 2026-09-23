# Deploying the Academy API on Render, by hand

Blueprints (`render.yaml`) need a paid workspace, so the API service is created by hand in
the dashboard. The settings below are the same ones `render.yaml` describes — keep the two
in step if either changes.

Only the API lives on Render. The database stays on Supabase, where the Academy's students
already are.

The web app is not deployed here. It runs on Cloudflare (`apps/web/wrangler.jsonc`) and
proxies `/api` and `/healthz` to this service, so the browser only ever sees one origin.

## 1. The database stays on Supabase

The Academy's database is Supabase project **`sevkabyfvpksxckkqttj`**. It was a fresh,
empty project — no `public` tables and no `auth.users` — so the v2 schema was pushed into
it on 22 Sep 2026: 26 tables, and `prisma migrate diff` now reports an empty migration.
The students still have to be copied in from the old database (§4).

That project's Postgres runs in **AWS ap-south-1 (Mumbai)**. The live service is in
**Oregon**, which costs roughly half a second per request in database round trips —
measured: `/healthz` 0.28s against `/api/courses` 0.80s. Singapore is the closest region
Render offers and would cut most of that, but a service's region cannot be changed after
creation, so moving means creating a second service and repointing `API_ORIGIN`.

`SUPABASE_URL` points at the **shared** BrahmAstra project (`frnlloffzfnohagpwsti`), not
here: a Google sign-in on the Academy creates or updates the user there, so the Studio and
the Academy see one person. Only `DATABASE_URL` and `DIRECT_URL` point at this project.
Its `profiles` table and the `Profile` model in `schema.prisma` exist so the two projects
stay swappable.

Two things the database needed beyond `prisma db push`, both in `supabase/migrations/`:

- **`20260923010000_lock_public_schema.sql`** — Supabase serves `public` over PostgREST as
  the `anon` role, and the anon key is public by design. Prisma's tables arrived with
  Supabase's default grants, leaving password hashes, session tokens and enrolments
  readable *and writable* by anyone holding that key. This revokes anon and authenticated,
  revokes them from future tables too, and enables RLS on every table. **Run it again after
  any push that adds tables.**
- **`20260923020000_profiles_standalone.sql`** — the mirror's `profiles` row, which exists
  on the shared project but not on a fresh one. A matching `Profile` model sits in
  `schema.prisma` so `db push` leaves the table alone rather than dropping it.

From the project's **Connect** panel, take the **session pooler** string (port 5432) and
use it for both `DATABASE_URL` and `DIRECT_URL`:

```
postgresql://postgres.sevkabyfvpksxckkqttj:<password>@<host>-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require
```

Two things decide which string is the right one:

- **Session pooler, not transaction pooler.** This API is a long-lived server, which is
  what session mode is for. The transaction pooler (6543) is for serverless and needs
  `&pgbouncer=true`, which turns off prepared statements.
- **Pooler host, not `db.sevkabyfvpksxckkqttj.supabase.co`.** The direct host resolves to
  IPv6 only (`2406:da1a::/35`, ap-south-1) unless the project has the IPv4 add-on, and
  Render cannot reach it.

If the project is on Supabase's free plan, note that it pauses after 7 days without
activity — fine while building, not for students who paid.

## 2. The web service

**New → Web Service →** `https://github.com/vfxcook/vfx-cook-academy` (public, so it needs
no GitHub connection).

| Setting | Value |
| --- | --- |
| Branch | `version/2.0-dbsetup` |
| Root directory | *(blank — the monorepo root)* |
| Language | Node |
| Region | Singapore — the closest to the database. The live service is in Oregon; see §1 |
| Build command | `npm ci --include=dev && npm run build --workspace @academy/server` |
| Start command | `npm start` |
| Health check path | `/healthz` |
| Pre-deploy command | `npx prisma db push --schema prisma/schema.prisma --skip-generate` |
| Auto-deploy | On commit |
| Instance type | 0.5 CPU / 512 MB or larger |

The pre-deploy command only exists on paid instance types. On a free instance leave it out
and create the tables from your laptop instead (§3); a free instance also sleeps after 15
minutes idle, which means a ~50 second cold start on the first lesson someone opens.

### Environment variables

| Key | Value |
| --- | --- |
| `NODE_VERSION` | `22` |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Supabase session pooler string (§1) |
| `DIRECT_URL` | the same string |
| `APP_URL` | `https://academy.brahmastra.studio` |
| `COOKIE_DOMAIN` | `.brahmastra.studio` |
| `ALLOWED_ORIGINS` | `https://academy.brahmastra.studio,https://brahmastra.studio,https://*.brahmastra.studio` |
| `PROXY_SHARED_SECRET` | byte for byte the Worker's secret, from `.secrets/proxy-shared-secret.env` |
| `GOOGLE_CLIENT_ID` | `706720560213-1f3dmo50amk180u2a7o6qcuqh2hm435i.apps.googleusercontent.com` |
| `SUPABASE_URL` | `https://frnlloffzfnohagpwsti.supabase.co` — the shared project, where identities are mirrored |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` |
| `ADMIN_EMAIL` | the Google account that owns the Academy — signing in with it grants admin |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay → Settings → API Keys |
| `RAZORPAY_WEBHOOK_SECRET` | the secret on the webhook pointed at `https://academy.brahmastra.studio/api/payments/razorpay-webhook` |
| `QR_CODE_URL` | the UPI QR image used on the manual payment screen |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | Zoho India: `smtp.zoho.in` and an app password |
| `SMTP_PORT` | `587` |
| `EMAIL_FROM` | `BrahmAstra Academy <noreply@brahmastra.studio>` |
| `KIE_API_KEY` | the KIE key for the generation features |

Everything else has a safe default. A missing Razorpay or SMTP key disables that feature
rather than stopping the server.

Google is the only way in: there are no password or emailed-link sign-ins, so a missing
`GOOGLE_CLIENT_ID` (or an origin not registered on that client) means nobody can sign in,
including the admin.

## 3. Bringing the schema up to date — look before you push

The schema is already in place, so the pre-deploy command is currently a no-op. Once the
database holds live rows, read what `prisma db push` intends to do before anything runs
it. From the repo root:

```
npx prisma migrate diff --from-url "<session pooler url>" --to-schema-datamodel prisma/schema.prisma --script
```

Empty output means the live schema already matches and the pre-deploy command is a no-op.
Otherwise the SQL it prints is exactly what would be applied. `prisma db push` refuses
changes that would drop data, so a destructive diff shows up as a failed deploy rather
than as lost enrolments — but it is much better to know beforehand.

When the diff is clean, apply it:

```
DATABASE_URL="<session pooler url>" DIRECT_URL="<session pooler url>" npm run db:push
```

## 4. Bringing the students across

This project started empty, so the people who paid are still in the old Academy database.
Until they are copied over, everyone who signs in looks like a new visitor and lands on the
offer instead of the classroom.

```
SOURCE_DATABASE_URL="<old database url>" TARGET_DATABASE_URL="<this project's url>" npm run db:copy
```

Rows keep their ids, so enrolments, payments and progress stay attached to the same people.
Sessions and one-time tokens are deliberately left behind — everyone signs in again. The
copy refuses to run into a database that already has users unless you pass `--force`.

With no old database to copy from, `npm run db:seed` lays down the courses and settings a
fresh install needs instead.

## 5. Pointing the Worker at the service

The live service is named `academy` but answers on `https://vfx-cook-academy.onrender.com`
— Render keeps the URL a service was created with. `API_ORIGIN` in
`apps/web/wrangler.jsonc` holds that hostname; change it there and redeploy if the service
is ever recreated:

```
npm run deploy:worker --workspace @academy/web
```

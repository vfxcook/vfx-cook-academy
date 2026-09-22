# Deploying the Academy API on Render, by hand

Blueprints (`render.yaml`) need a paid workspace, so the API service is created by hand in
the dashboard. The settings below are the same ones `render.yaml` describes — keep the two
in step if either changes.

Only the API lives on Render. The database stays on Supabase, where the Academy's students
already are.

The web app is not deployed here. It runs on Cloudflare (`apps/web/wrangler.jsonc`) and
proxies `/api` and `/healthz` to this service, so the browser only ever sees one origin.

## 1. The database stays on Supabase

Nothing to create. The Academy already runs on Supabase Postgres, so pointing the API at
it keeps every student, enrolment and payment exactly where it is — no migration, and no
second database to pay for.

From the project's **Connect** panel, take the **session pooler** string (port 5432) and
use it for both `DATABASE_URL` and `DIRECT_URL`:

```
postgresql://postgres.<project-ref>:<password>@<region>.pooler.supabase.com:5432/postgres?sslmode=require
```

Three things decide which string is the right one:

- **Session pooler, not transaction pooler.** This API is a long-lived server, which is
  what session mode is for. The transaction pooler (6543) is for serverless and needs
  `&pgbouncer=true`, which turns off prepared statements.
- **Pooler host, not `db.<ref>.supabase.co`.** The direct host is IPv6 only unless the
  project has the IPv4 add-on, and Render cannot reach it.
- **The region in that hostname is the region to give Render**, so the API sits next to
  its database instead of crossing an ocean on every query.

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
| Region | the one closest to the Supabase region in the pooler hostname |
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
| `SUPABASE_URL` | `https://frnlloffzfnohagpwsti.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` |
| `ADMIN_EMAIL` | the Google account that owns the Academy |
| `ADMIN_PASSWORD` | a new one — the old password is in this repo's git history |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Razorpay → Settings → API Keys |
| `RAZORPAY_WEBHOOK_SECRET` | the secret on the webhook pointed at `https://academy.brahmastra.studio/api/payments/razorpay-webhook` |
| `QR_CODE_URL` | the UPI QR image used on the manual payment screen |
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | Zoho India: `smtp.zoho.in` and an app password |
| `SMTP_PORT` | `587` |
| `EMAIL_FROM` | `BrahmAstra Academy <noreply@brahmastra.studio>` |
| `KIE_API_KEY` | the KIE key for the generation features |

Everything else has a safe default. A missing Razorpay or SMTP key disables that feature
rather than stopping the server.

## 3. Bringing the schema up to date — look before you push

The database already holds live rows, so read what `prisma db push` intends to do before
anything runs it. From the repo root:

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

## 4. If the students are in a different Supabase project

Only when the API points at a project that does not already hold them:

```
SOURCE_DATABASE_URL="<old project url>" TARGET_DATABASE_URL="<new project url>" npm run db:copy
```

Rows keep their ids, so enrolments, payments and progress stay attached to the same people.
Sessions and one-time tokens are deliberately left behind — everyone signs in again.

## 5. Pointing the Worker at the service

Render names the service `https://<name>.onrender.com`, and adds a suffix if the name is
taken. If it is not `https://brahmastra-academy-api.onrender.com`, update `API_ORIGIN` in
`apps/web/wrangler.jsonc` and redeploy:

```
npm run deploy:worker --workspace @academy/web
```

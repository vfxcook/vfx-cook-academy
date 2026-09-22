# Deploying the Academy API on Render, by hand

Blueprints (`render.yaml`) need a paid workspace, so the two resources are created
separately: the database first, then the web service that connects to it. The settings
below are the same ones `render.yaml` describes — keep the two in step if either changes.

The web app is not deployed here. It runs on Cloudflare (`apps/web/wrangler.jsonc`) and
proxies `/api` and `/healthz` to this service, so the browser only ever sees one origin.

## 1. The database

**New → Postgres**

| Setting | Value |
| --- | --- |
| Name | `brahmastra-academy-db` |
| Database | `academy` |
| User | `academy` |
| Region | Singapore — the web service must match, or it cannot use the internal URL |
| PostgreSQL version | 17 |
| Instance type | Any paid tier; 0.1 CPU / 256 MB is the smallest |

Not the free tier: free instances are deleted 30 days after creation (with a 14-day grace
period to upgrade), and this database holds paying students' enrolments and payments.

From the database's **Connect** menu, keep both strings:

- **Internal URL** — what the API uses. Same region, private network, no egress.
- **External URL** — what your laptop uses for the schema push and the data copy below.

## 2. The web service

**New → Web Service →** `https://github.com/vfxcook/vfx-cook-academy` (public, so it needs
no GitHub connection).

| Setting | Value |
| --- | --- |
| Branch | `version/2.0-dbsetup` |
| Root directory | *(blank — the monorepo root)* |
| Language | Node |
| Region | Singapore — same as the database |
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
| `DATABASE_URL` | the database's **internal** URL |
| `DIRECT_URL` | the same internal URL |
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

## 3. Creating the tables

With a pre-deploy command, every deploy brings the schema up to date by itself. Without
one, run this once from the repo root against the **external** URL:

```
DATABASE_URL="<external url>" DIRECT_URL="<external url>" npm run db:push
```

`prisma db push` refuses changes that would drop data, so it is safe to re-run.

## 4. Moving the existing students across

```
SOURCE_DATABASE_URL="<old Supabase url>" TARGET_DATABASE_URL="<external Render url>" npm run db:copy
```

Rows keep their ids, so enrolments, payments and progress stay attached to the same people.
Sessions and one-time tokens are deliberately left behind — everyone signs in again.

Afterwards, restrict the database under **Access Control**: remove `0.0.0.0/0` so only
Render's private network reaches it.

## 5. Pointing the Worker at the service

Render names the service `https://<name>.onrender.com`, and adds a suffix if the name is
taken. If it is not `https://brahmastra-academy-api.onrender.com`, update `API_ORIGIN` in
`apps/web/wrangler.jsonc` and redeploy:

```
npm run deploy:worker --workspace @academy/web
```

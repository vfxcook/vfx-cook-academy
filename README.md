# VFX Cook Academy - MVP

Lightweight video course platform with:

- Google login and email one-time login links
- Course purchase flow using QR payment + admin review
- Optional Razorpay Payment Link button + admin review
- Email one-time license code unlock per paid course
- Timeline timestamp comments on lessons
- Real email/password login + registration
- Course progress tracking (mark lesson complete)
- Next.js + Prisma + SQLite (fast start, easy to host)

## 1) Setup

```bash
cp .env.example .env
```

Update env values in `.env`.

## 2) Initialize DB + seed sample course

```bash
npm install
npm run db:push
npm run db:seed
```

## 3) Run locally

```bash
npm run dev
```

Open `http://localhost:3000`.

## 4) Admin workflow

1. User submits UTR/payment reference on course page.
2. Admin logs in with admin account and opens `/admin`.
3. Click **Approve** to generate one-time course license code and email it.
4. User enters code in dashboard to activate course access.

## 5) Razorpay quick setup for current manual approval flow

1. Create a Razorpay Payment Link for INR 499.
2. Put the link in `.env` as `NEXT_PUBLIC_RAZORPAY_PAYMENT_LINK`.
3. Restart the app.
4. User pays with Razorpay, then submits Razorpay payment ID / UTR on the course page.
5. Admin approves the payment request and the app emails the license code.

## 6) Deploy today (quick path)

### Option A: Vercel + Neon/Supabase Postgres (recommended for production)

- Push project to GitHub.
- Import repo in Vercel.
- Add all env vars from `.env.example`.
- Replace `DATABASE_URL` with Neon/Supabase Postgres URL.
- Change Prisma datasource provider in `prisma/schema.prisma` from `sqlite` to `postgresql`.
- Run `npx prisma db push` once on deployed environment or CI.

### Option B: Render/Railway with persistent disk + SQLite

- Works for low traffic quickly.
- Must mount persistent volume and keep `DATABASE_URL=file:...` pointing to mounted path.

## Notes

- "Non-downloadable" video is best-effort only on web.
- For stronger protection later, move to signed URLs + DRM provider.
- Current MVP embeds hosted video URLs (e.g. unlisted YouTube or cloud player URLs).

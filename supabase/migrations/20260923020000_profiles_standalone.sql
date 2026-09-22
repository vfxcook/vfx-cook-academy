-- The `profiles` row the Academy writes after each Google sign-in.
--
-- On the shared BrahmAstra project this table already exists and belongs to the Studio;
-- there the Academy only adds columns (see 20260922120000_academy_profiles.sql). When the
-- Academy runs against its own Supabase project, nothing has created it, and every sign-in
-- logs a failed mirror. This creates the same shape, so the two projects stay swappable.
--
-- Not reachable through PostgREST: no grants to anon or authenticated, and RLS on with no
-- policy. The mirror writes it with the service_role key, which bypasses both.

create table if not exists public.profiles (
  id uuid primary key,
  email text,
  full_name text,
  avatar_url text,
  provider text,
  last_sign_in_at timestamptz,
  updated_at timestamptz default now(),
  academy_user_id text,
  academy_access boolean not null default false,
  academy_last_sign_in_at timestamptz
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;

create index if not exists profiles_email_idx on public.profiles (email);

-- Lets the Studio, or an admin screen here, list Academy members cheaply. Deliberately
-- not a partial index: Prisma cannot express one, and `prisma db push` drops whatever it
-- cannot see in the schema.
create index if not exists profiles_academy_access_idx on public.profiles (academy_access);

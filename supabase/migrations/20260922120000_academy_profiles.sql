-- Columns the Academy API writes on the shared BrahmAstra `profiles` row after each Google
-- sign-in. Additive only: nothing here drops, renames or retypes an existing column, and
-- every statement is safe to re-run.
--
-- The live table has drifted from what the Studio's own migrations describe — as of
-- 23 Sep 2026 it carries id, email, full_name and avatar_url and none of the six below —
-- so the Academy falls back to writing only those four until this runs. That fallback
-- works, but nothing then records who paid for the Academy.

-- Shared with the Studio: which provider signed this person in, and when.
alter table public.profiles add column if not exists provider text;
alter table public.profiles add column if not exists last_sign_in_at timestamptz;
alter table public.profiles add column if not exists updated_at timestamptz default now();

-- Owned by the Academy. `academy_access` is what lets the Studio tell a paying student
-- from a visitor without asking the Academy's API.
alter table public.profiles add column if not exists academy_user_id text;
alter table public.profiles add column if not exists academy_access boolean not null default false;
alter table public.profiles add column if not exists academy_last_sign_in_at timestamptz;

-- Lets the Studio list Academy members cheaply.
create index if not exists profiles_academy_access_idx
  on public.profiles (academy_access)
  where academy_access;

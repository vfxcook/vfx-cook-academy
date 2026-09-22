-- Academy columns on the shared BrahmAstra `profiles` row, written by the Academy API
-- after each Google sign-in. Additive only: nothing here drops, renames or retypes an
-- existing column. Until this runs, the Academy still writes the name, avatar and
-- sign-in time, and simply skips these three fields.

alter table public.profiles add column if not exists academy_user_id text;
alter table public.profiles add column if not exists academy_access boolean not null default false;
alter table public.profiles add column if not exists academy_last_sign_in_at timestamptz;

-- Lets the Studio list Academy members cheaply.
create index if not exists profiles_academy_access_idx
  on public.profiles (academy_access)
  where academy_access;

-- Supabase serves every table in `public` over PostgREST, authenticating requests as the
-- `anon` role — and the anon key is public by design, shipped in browsers. Prisma creates
-- the Academy's tables knowing nothing about that, and Supabase's default privileges then
-- granted anon and authenticated full read and write on all 26 of them: password hashes,
-- session tokens, enrolments, prices.
--
-- Nothing legitimate uses those roles here. The API connects as `postgres` over its own
-- connection, and the identity mirror uses `service_role`; both bypass RLS.
--
-- Run this after any `prisma db push` that adds tables.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all routines in schema public from anon, authenticated;

-- Tables a later push creates arrive locked instead of exposed.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

-- Belt and braces: with row level security on and no policy, even a stray grant yields
-- nothing. Both roles that need the data hold bypassrls.
do $$
declare
  target text;
begin
  for target in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format('alter table public.%I enable row level security', target);
  end loop;
end $$;

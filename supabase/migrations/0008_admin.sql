-- Ledger — admin dashboard
--
-- A short list of accounts that may see every user of the app. The list lives
-- in its own table rather than as a column on profiles: profiles carries an
-- "update self" policy, so a flag there could be switched on by its own owner.
--
-- Grant access from the SQL Editor (there is deliberately no way to do it from
-- the app):
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'you@example.com'
--   on conflict do nothing;
--
-- Safe to run more than once.

create table if not exists public.admins (
  user_id    uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

-- RLS on with no policies: no client role can read or write the list. The
-- functions below are security definer, which is the only way in.
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

-- Every account, newest first. auth.users is the source of truth — a user whose
-- profile row is missing still shows up.
create or replace function public.admin_list_users()
returns table (
  id                 uuid,
  email              text,
  full_name          text,
  created_at         timestamptz,
  last_sign_in_at    timestamptz,
  email_confirmed_at timestamptz,
  business_count     int,
  is_admin           boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'Only an admin can list users.' using errcode = '42501';
  end if;

  return query
  select
    u.id,
    u.email::text,
    p.full_name,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    (select count(*)::int from public.businesses b where b.owner_id = u.id),
    exists (select 1 from public.admins a where a.user_id = u.id)
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.created_at desc;
end;
$$;

-- Supabase grants execute on new functions to anon as well; signed-out callers
-- have no business here.
revoke all on function public.is_admin()         from public, anon;
revoke all on function public.admin_list_users() from public, anon;
grant execute on function public.is_admin()         to authenticated;
grant execute on function public.admin_list_users() to authenticated;

-- The owner's account. Does nothing until that account has signed up, so run
-- this file again if it was applied first.
insert into public.admins (user_id)
select id from auth.users where email = 'sachinharshitha179@gmail.com'
on conflict do nothing;

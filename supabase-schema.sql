-- UMKMHUB Supabase schema (run once in Supabase SQL Editor).
-- Uses Supabase Auth identities; never store passwords or service-role keys here.
create extension if not exists pgcrypto;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin'))
);

create or replace function public.is_umkmhub_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles r where r.user_id = (select auth.uid()) and r.role = 'admin');
$$;

create or replace function public.guard_business_review_fields()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not public.is_umkmhub_admin() and coalesce(current_setting('umkmhub.claim_legacy', true), 'false') <> 'true' then
    if new.owner_id is distinct from old.owner_id
       or new.status is distinct from old.status
       or new.created_at is distinct from old.created_at then
      raise exception 'Only UMKMHUB admins may change ownership, verification status, or creation time';
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  name text not null,
  owner text not null,
  phone text not null,
  email text not null,
  owner_address text,
  category text not null,
  year integer,
  address text not null,
  region text,
  description text,
  employees integer not null default 0,
  revenue numeric not null default 0,
  products integer not null default 0,
  product_list jsonb not null default '[]'::jsonb,
  business_status text not null default 'Aktif' check (business_status in ('Aktif','Tidak Aktif')),
  social text,
  photo_url text,
  status text not null default 'Menunggu Verifikasi' check (status in ('Menunggu Verifikasi','Terverifikasi','Tidak Aktif')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_verified_business(target_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.businesses b where b.id = target_id and b.status = 'Terverifikasi');
$$;

create or replace function public.normalize_umkmhub_phone(value text)
returns text language sql immutable set search_path = '' as $$
  select case when regexp_replace(coalesce(value,''), '\D', '', 'g') like '0%'
    then '62' || substr(regexp_replace(coalesce(value,''), '\D', '', 'g'),2)
    else regexp_replace(coalesce(value,''), '\D', '', 'g') end;
$$;

create or replace function public.claim_legacy_businesses_by_phone()
returns setof public.businesses language plpgsql security definer set search_path = '' as $$
declare verified_phone text;
begin
  select public.normalize_umkmhub_phone(u.phone) into verified_phone from auth.users u
  where u.id=(select auth.uid()) and u.phone_confirmed_at is not null;
  if verified_phone is null then raise exception 'Nomor telepon harus terverifikasi sebelum menghubungkan profil lama'; end if;
  perform set_config('umkmhub.claim_legacy','true',true);
  return query update public.businesses b set owner_id=(select auth.uid()),updated_at=now()
    where b.owner_id is null and public.normalize_umkmhub_phone(b.phone)=verified_phone and b.status <> 'Tidak Aktif'
    returning b.*;
end;
$$;

-- The public directory intentionally excludes private owner contact/address and
-- monitoring revenue details; public pages should query this view, not the base table.
create or replace view public.business_directory as
  select id, name, owner, phone, category, year, address, region, description,
         products, product_list, business_status, social, photo_url, status, created_at
  from public.businesses
  where status = 'Terverifikasi';

drop trigger if exists guard_business_review_fields on public.businesses;
create trigger guard_business_review_fields before update on public.businesses
  for each row execute function public.guard_business_review_fields();

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  product text,
  price text,
  created_at timestamptz not null default now()
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.user_roles enable row level security;
alter table public.businesses enable row level security;
alter table public.posts enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_likes enable row level security;

drop policy if exists "Admins manage roles" on public.user_roles;
create policy "Admins manage roles" on public.user_roles for all to authenticated
  using (public.is_umkmhub_admin()) with check (public.is_umkmhub_admin());

drop policy if exists "Public sees verified businesses" on public.businesses;
drop policy if exists "Owners and admins see protected business data" on public.businesses;
create policy "Owners and admins see protected business data" on public.businesses for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_umkmhub_admin());
drop policy if exists "Sellers create their pending business" on public.businesses;
create policy "Sellers create their pending business" on public.businesses for insert to authenticated
  with check (owner_id = (select auth.uid()) and status = 'Menunggu Verifikasi');
drop policy if exists "Admins import legacy businesses" on public.businesses;
create policy "Admins import legacy businesses" on public.businesses for insert to authenticated
  with check (public.is_umkmhub_admin());
drop policy if exists "Owners update their business profile" on public.businesses;
create policy "Owners update their business profile" on public.businesses for update to authenticated
  using (owner_id = (select auth.uid()) or public.is_umkmhub_admin())
  with check (owner_id = (select auth.uid()) or public.is_umkmhub_admin());
drop policy if exists "Admins delete businesses" on public.businesses;
create policy "Admins delete businesses" on public.businesses for delete to authenticated
  using (public.is_umkmhub_admin());

drop policy if exists "Public reads posts from verified businesses" on public.posts;
create policy "Public reads posts from verified businesses" on public.posts for select to anon, authenticated
  using (public.is_verified_business(business_id) or owner_id = (select auth.uid()) or public.is_umkmhub_admin());
drop policy if exists "Owners create posts" on public.posts;
create policy "Owners create posts" on public.posts for insert to authenticated
  with check (owner_id = (select auth.uid()) and exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = (select auth.uid()) and b.status = 'Terverifikasi'));
drop policy if exists "Owners manage own posts" on public.posts;
create policy "Owners manage own posts" on public.posts for delete to authenticated using (owner_id = (select auth.uid()) or public.is_umkmhub_admin());

drop policy if exists "Public reads comments" on public.post_comments;
create policy "Public reads comments" on public.post_comments for select to anon, authenticated using (true);
drop policy if exists "Signed-in users comment" on public.post_comments;
create policy "Signed-in users comment" on public.post_comments for insert to authenticated with check (author_id = (select auth.uid()));
drop policy if exists "Authors or admins remove comments" on public.post_comments;
create policy "Authors or admins remove comments" on public.post_comments for delete to authenticated using (author_id = (select auth.uid()) or public.is_umkmhub_admin());

drop policy if exists "Public reads likes" on public.post_likes;
create policy "Public reads likes" on public.post_likes for select to anon, authenticated using (true);
drop policy if exists "Signed-in users like" on public.post_likes;
create policy "Signed-in users like" on public.post_likes for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "Users remove own likes" on public.post_likes;
create policy "Users remove own likes" on public.post_likes for delete to authenticated using (user_id = (select auth.uid()));

revoke select on public.businesses from anon;
grant select on public.business_directory, public.posts, public.post_comments, public.post_likes to anon, authenticated;
grant select on public.businesses to authenticated;
grant insert, update, delete on public.businesses, public.posts to authenticated;
grant select, insert, delete on public.post_comments, public.post_likes to authenticated;
grant select on public.user_roles to authenticated;
grant execute on function public.claim_legacy_businesses_by_phone() to authenticated;

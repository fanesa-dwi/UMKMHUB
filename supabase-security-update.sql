-- Run once after supabase-schema.sql if that earlier version was already applied.
alter table public.businesses alter column owner_id drop not null;
alter table public.businesses drop constraint if exists businesses_owner_id_fkey;
alter table public.businesses add constraint businesses_owner_id_fkey foreign key (owner_id) references auth.users(id) on delete set null;
drop policy if exists "Public sees verified businesses" on public.businesses;
drop policy if exists "Owners and admins see protected business data" on public.businesses;
create policy "Owners and admins see protected business data" on public.businesses
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_umkmhub_admin());

create or replace view public.business_directory as
  select id, name, owner, phone, category, year, address, region, description,
         products, product_list, business_status, social, photo_url, status, created_at
  from public.businesses
  where status = 'Terverifikasi';

revoke select on public.businesses from anon;
grant select on public.business_directory to anon, authenticated;
grant select on public.businesses to authenticated;

create or replace function public.normalize_umkmhub_phone(value text)
returns text language sql immutable set search_path = '' as $$
  select case when regexp_replace(coalesce(value,''), '\D', '', 'g') like '0%'
    then '62' || substr(regexp_replace(coalesce(value,''), '\D', '', 'g'),2)
    else regexp_replace(coalesce(value,''), '\D', '', 'g') end;
$$;

create or replace function public.guard_business_review_fields()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not public.is_umkmhub_admin() and coalesce(current_setting('umkmhub.claim_legacy', true), 'false') <> 'true' then
    if new.owner_id is distinct from old.owner_id or new.status is distinct from old.status or new.created_at is distinct from old.created_at then
      raise exception 'Only UMKMHUB admins may change ownership, verification status, or creation time';
    end if;
  end if;
  new.updated_at=now(); return new;
end;
$$;
drop trigger if exists guard_business_review_fields on public.businesses;
create trigger guard_business_review_fields before update on public.businesses for each row execute function public.guard_business_review_fields();

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
grant execute on function public.claim_legacy_businesses_by_phone() to authenticated;
drop policy if exists "Admins import legacy businesses" on public.businesses;
create policy "Admins import legacy businesses" on public.businesses for insert to authenticated with check (public.is_umkmhub_admin());

create or replace function public.is_verified_business(target_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.businesses b where b.id = target_id and b.status = 'Terverifikasi');
$$;
drop policy if exists "Public reads posts from verified businesses" on public.posts;
create policy "Public reads posts from verified businesses" on public.posts for select to anon, authenticated
  using (public.is_verified_business(business_id) or owner_id = (select auth.uid()) or public.is_umkmhub_admin());

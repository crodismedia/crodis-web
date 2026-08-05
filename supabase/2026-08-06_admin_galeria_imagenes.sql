-- TallerMap: permisos seguros para gestionar imágenes desde el editor administrativo.
-- Ejecutar en Supabase SQL Editor antes de activar la subida desde el panel.

begin;

-- El bucket y la columna ya existen en la instalación actual.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos-talleres',
  'fotos-talleres',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.talleres
  add column if not exists fotos text[] not null default '{}';

alter table public.talleres
  drop constraint if exists talleres_maximo_cinco_fotos;
alter table public.talleres
  add constraint talleres_maximo_cinco_fotos
  check (cardinality(fotos) <= 5)
  not valid;

-- Ruta administrativa: talleres/{uuid}/{archivo}.jpg|png|webp
create or replace function public.es_ruta_foto_taller_admin(p_ruta text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.es_administrador()
     and p_ruta ~ '^talleres/[0-9a-f-]{36}/[a-z0-9._-]+\.(jpg|jpeg|png|webp)$';
$$;

revoke all on function public.es_ruta_foto_taller_admin(text) from public;
grant execute on function public.es_ruta_foto_taller_admin(text) to authenticated;

drop policy if exists "administradores suben fotos de talleres" on storage.objects;
create policy "administradores suben fotos de talleres"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'fotos-talleres'
  and public.es_ruta_foto_taller_admin(name)
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
);

drop policy if exists "administradores actualizan fotos de talleres" on storage.objects;
create policy "administradores actualizan fotos de talleres"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'fotos-talleres'
  and public.es_administrador()
)
with check (
  bucket_id = 'fotos-talleres'
  and public.es_ruta_foto_taller_admin(name)
);

drop policy if exists "administradores eliminan fotos de talleres" on storage.objects;
create policy "administradores eliminan fotos de talleres"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'fotos-talleres'
  and public.es_administrador()
);

commit;

-- Verificación:
-- select id, name, public, file_size_limit, allowed_mime_types
-- from storage.buckets where id = 'fotos-talleres';

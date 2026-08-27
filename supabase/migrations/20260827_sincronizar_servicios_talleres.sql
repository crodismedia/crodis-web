-- TallerMap: unifica los servicios guardados con el catálogo oficial.
-- El array talleres.servicios sigue siendo la fuente editable y
-- talleres_servicios se mantiene sincronizada para los buscadores.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.talleres_servicios_backup_20260827 (
  taller_id uuid primary key,
  servicios text[] not null,
  backed_up_at timestamptz not null default now()
);

revoke all on table private.talleres_servicios_backup_20260827
from public, anon, authenticated;

insert into private.talleres_servicios_backup_20260827 (taller_id, servicios)
select id, coalesce(servicios, '{}'::text[])
from public.talleres
on conflict (taller_id) do nothing;

-- Entradas antiguas que duplicaban servicios del catálogo principal.
update public.servicios
set activo = false,
    updated_at = now()
where slug in (
  'alineacion',
  'cristaleria',
  'distribucion',
  'escape',
  'pre-itv-anterior-12',
  'vehiculo-hibrido-y-electrico'
)
and activo is distinct from false;

-- Servicios legítimos ya presentes en talleres que faltaban en el catálogo.
insert into public.servicios (
  slug, nombre, categoria, sinonimos, popular, activo, orden, updated_at
) values
  (
    'mecanica-rapida', 'Mecánica rápida', 'Mecánica y mantenimiento',
    array['servicio rapido','reparacion rapida'], false, true, 700, now()
  ),
  (
    'motocicletas', 'Motocicletas', 'Vehículos especiales',
    array['motos','reparacion motocicletas'], false, true, 710, now()
  ),
  (
    'vehiculos-clasicos', 'Vehículos clásicos', 'Vehículos especiales',
    array['vehiculo clasico','restauracion clasicos'], false, true, 720, now()
  ),
  (
    'tacografo', 'Tacógrafo', 'Electricidad y diagnosis',
    array['tacografos'], false, true, 730, now()
  )
on conflict (slug) do update set
  nombre = excluded.nombre,
  categoria = excluded.categoria,
  sinonimos = excluded.sinonimos,
  activo = true,
  orden = excluded.orden,
  updated_at = excluded.updated_at;

create table if not exists private.servicios_aliases_tallermap (
  termino text primary key,
  servicio_slug text not null references public.servicios(slug) on update cascade on delete restrict
);

create index if not exists servicios_aliases_tallermap_servicio_slug_idx
  on private.servicios_aliases_tallermap (servicio_slug);

revoke all on table private.servicios_aliases_tallermap
from public, anon, authenticated;

truncate table private.servicios_aliases_tallermap;

-- Prioridad: slug oficial, nombre visible y después sinónimos.
insert into private.servicios_aliases_tallermap (termino, servicio_slug)
select public.normalizar_texto_servicio(s.slug), s.slug
from public.servicios s
where s.activo = true
  and public.normalizar_texto_servicio(s.slug) <> ''
order by s.orden, s.slug
on conflict (termino) do nothing;

insert into private.servicios_aliases_tallermap (termino, servicio_slug)
select public.normalizar_texto_servicio(s.nombre), s.slug
from public.servicios s
where s.activo = true
  and public.normalizar_texto_servicio(s.nombre) <> ''
order by s.orden, s.slug
on conflict (termino) do nothing;

insert into private.servicios_aliases_tallermap (termino, servicio_slug)
select public.normalizar_texto_servicio(x.sinonimo), s.slug
from public.servicios s
cross join lateral unnest(coalesce(s.sinonimos, '{}'::text[])) x(sinonimo)
where s.activo = true
  and public.normalizar_texto_servicio(x.sinonimo) <> ''
order by s.orden, s.slug
on conflict (termino) do nothing;

-- Equivalencias inequívocas detectadas en los datos históricos.
insert into private.servicios_aliases_tallermap (termino, servicio_slug) values
  ('alineacion','alineacion-direccion'),
  ('convergencia-de-ruedas','alineacion-direccion'),
  ('cristaleria','lunas-cristales'),
  ('cristales-lunas','lunas-cristales'),
  ('lunas-parabrisas','lunas-cristales'),
  ('distribucion','correa-distribucion'),
  ('pre-itv-anterior-12','pre-itv'),
  ('vehiculo-hibrido-y-electrico','hibridos-electricos'),
  ('vehiculos-electricos-hibridos','hibridos-electricos'),
  ('vehiculos-hibridos','hibridos-electricos'),
  ('climatizacion','calefaccion-climatizacion'),
  ('escapes','escape-catalizador'),
  ('cambio-aceite','cambio-aceite-filtros'),
  ('caja-cambios-automatica','caja-cambios-automatica-dsg'),
  ('centralitas','centralitas-electronica'),
  ('codificacion-llaves','llaves-codificacion'),
  ('alternadores','alternador-motor-arranque'),
  ('motor-de-arranque','alternador-motor-arranque'),
  ('reprogramacion-de-centralitas','reprogramacion-centralita'),
  ('instalacion-accesorios','montaje-accesorios'),
  ('accesorios-para-automoviles','montaje-accesorios'),
  ('asistencia-carretera','grua-asistencia'),
  ('limpieza-filtro-particulas','filtro-particulas-dpf-fap'),
  ('limpieza-dpf-fap','filtro-particulas-dpf-fap'),
  ('reparacion-turbos','turbo'),
  ('reparacion-turbo','turbo'),
  ('turbo-compresores','turbo'),
  ('turbos','turbo'),
  ('pulido-faros','pulido-restauracion-faros'),
  ('restauracion-faros','pulido-restauracion-faros'),
  ('reparacion-faros','pulido-restauracion-faros'),
  ('recogida-a-domicilio','recogida-entrega'),
  ('recogida-del-vehiculo','recogida-entrega'),
  ('recogida-y-entrega','recogida-entrega'),
  ('entrega-y-recogida','recogida-entrega'),
  ('recogida-entrega-vehiculo','recogida-entrega'),
  ('coche-de-sustitucion','vehiculo-sustitucion'),
  ('vehiculo-de-cortesia','vehiculo-sustitucion'),
  ('vehiculos-segunda-mano','venta-vehiculos-ocasion'),
  ('preparacion-4x4','vehiculos-4x4'),
  ('todoterrenos','vehiculos-4x4'),
  ('vehiculos-comerciales','furgonetas'),
  ('automocion','mecanica-general'),
  ('reparacion','mecanica-general'),
  ('reparacion-de-vehiculos','mecanica-general'),
  ('reparacion-vehiculos','mecanica-general'),
  ('servicio-rapido','mecanica-rapida'),
  ('reparacion-rapida','mecanica-rapida'),
  ('motos','motocicletas'),
  ('reparacion-de-motocicletas','motocicletas'),
  ('reparacion-motocicletas','motocicletas'),
  ('vehiculo-clasico','vehiculos-clasicos'),
  ('restauracion-clasicos','vehiculos-clasicos'),
  ('tacografos','tacografo'),
  ('transmisiones','caja-cambios'),
  ('reparacion-bombas-inyeccion','inyeccion-diesel'),
  ('reparacion-bomba-inyeccion','inyeccion-diesel'),
  ('reparacion-inyectores','inyeccion-diesel'),
  ('venta-neumaticos','neumaticos'),
  ('montaje-neumaticos','neumaticos'),
  ('reparacion-neumaticos','neumaticos'),
  ('rotacion-de-neumaticos','neumaticos'),
  ('revision-de-presion','neumaticos'),
  ('liquido-frenos','frenos'),
  ('liquido-refrigerante','sistema-refrigeracion'),
  ('culatas','reparacion-motor'),
  ('car-audio','equipos-sonido'),
  ('audio-y-navegacion','multimedia-navegacion'),
  ('iluminacion','iluminacion-automovil'),
  ('alumbrado','iluminacion-automovil'),
  ('reglaje-de-faros','iluminacion-automovil'),
  ('glp-autogas','instalacion-glp'),
  ('glp-gnc','instalacion-glp'),
  ('vehiculos-gas','instalacion-glp'),
  ('lavado-a-mano','lavado-detailing'),
  ('limpieza-del-vehiculo','lavado-detailing'),
  ('pulido-y-abrillantado','lavado-detailing'),
  ('recubrimiento-ceramico','lavado-detailing')
on conflict (termino) do update
set servicio_slug = excluded.servicio_slug;

create or replace function private.canonizar_servicio_tallermap(p_servicio text)
returns text
language sql
stable
set search_path = public, private, pg_temp
as $$
  with valor as (
    select public.normalizar_texto_servicio(p_servicio) as termino
  )
  select case
    when termino in ('', 'servicios-de-automocion-pendientes-de-verificar') then null
    else coalesce(
      (
        select a.servicio_slug
        from private.servicios_aliases_tallermap a
        where a.termino = valor.termino
      ),
      termino
    )
  end
  from valor;
$$;

create or replace function private.canonizar_servicios_tallermap(p_servicios text[])
returns text[]
language sql
stable
set search_path = public, private, pg_temp
as $$
  with resueltos as (
    select private.canonizar_servicio_tallermap(x.valor) as slug,
           min(x.ord) as primera_posicion
    from unnest(coalesce(p_servicios, '{}'::text[]))
      with ordinality as x(valor, ord)
    group by private.canonizar_servicio_tallermap(x.valor)
  )
  select coalesce(
    array_agg(r.slug order by coalesce(s.orden, 10000), r.primera_posicion, r.slug)
      filter (where r.slug is not null),
    '{}'::text[]
  )
  from resueltos r
  left join public.servicios s
    on s.slug = r.slug
   and s.activo = true;
$$;

revoke all on function private.canonizar_servicio_tallermap(text)
from public, anon, authenticated;
revoke all on function private.canonizar_servicios_tallermap(text[])
from public, anon, authenticated;

update public.talleres
set servicios = private.canonizar_servicios_tallermap(servicios)
where servicios is distinct from private.canonizar_servicios_tallermap(servicios);

delete from public.talleres_servicios;

insert into public.talleres_servicios (taller_id, servicio_id, confirmado)
select t.id, s.id, true
from public.talleres t
cross join lateral unnest(coalesce(t.servicios, '{}'::text[])) x(slug)
join public.servicios s
  on s.slug = x.slug
 and s.activo = true
on conflict (taller_id, servicio_id) do update
set confirmado = excluded.confirmado;

create or replace function private.canonizar_servicios_taller_guardar()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  new.servicios := private.canonizar_servicios_tallermap(new.servicios);
  return new;
end;
$$;

create or replace function private.sincronizar_relacion_servicios_taller()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  delete from public.talleres_servicios
  where taller_id = new.id;

  insert into public.talleres_servicios (taller_id, servicio_id, confirmado)
  select new.id, s.id, true
  from unnest(coalesce(new.servicios, '{}'::text[])) x(slug)
  join public.servicios s
    on s.slug = x.slug
   and s.activo = true
  on conflict (taller_id, servicio_id) do update
  set confirmado = excluded.confirmado;

  return new;
end;
$$;

revoke all on function private.canonizar_servicios_taller_guardar()
from public, anon, authenticated;
revoke all on function private.sincronizar_relacion_servicios_taller()
from public, anon, authenticated;

drop trigger if exists aa_canonizar_servicios_taller on public.talleres;
create trigger aa_canonizar_servicios_taller
before insert or update of servicios on public.talleres
for each row execute function private.canonizar_servicios_taller_guardar();

drop trigger if exists trg_sincronizar_relacion_servicios_taller on public.talleres;
create trigger trg_sincronizar_relacion_servicios_taller
after insert or update of servicios on public.talleres
for each row execute function private.sincronizar_relacion_servicios_taller();

commit;

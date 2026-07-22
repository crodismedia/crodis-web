-- TallerMap: altas gratuitas y publicación automática en toda España.
-- Ejecuta este archivo completo una sola vez en Supabase > SQL Editor.

begin;

alter table public.solicitudes_alta_taller
    alter column estado set default 'aprobada';

-- El servidor impone la publicación automática. El navegador no puede
-- decidir un estado diferente ni marcar una ficha como verificada.
create or replace function public.preparar_estado_solicitud()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
    new.estado := 'aprobada';
    new.revisada_at := now();
    new.revisada_por := null;
    return new;
end;
$$;

create or replace function public.publicar_solicitud_automatica()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if exists (
        select 1
        from public.talleres t
        where t.activo = true
          and (
              lower(coalesce(t.cif, '')) = lower(new.cif)
              or (
                  lower(coalesce(t.nombre, '')) = lower(new.nombre_taller)
                  and lower(coalesce(t.direccion, '')) = lower(new.direccion)
              )
          )
    ) then
        raise exception 'duplicado: ya existe un taller con el mismo CIF o nombre y dirección'
            using errcode = '23505';
    end if;

    insert into public.talleres (
        solicitud_id, nombre, propietario, cif, email, telefono, web,
        direccion, codigo_postal, ciudad, provincia, pais,
        descripcion, servicios, fotos, verificado, activo
    ) values (
        new.id, new.nombre_taller, new.propietario, new.cif,
        new.email, new.telefono, new.web, new.direccion,
        new.codigo_postal, new.ciudad, new.provincia, 'España',
        new.descripcion, new.servicios, new.fotos, false, true
    );

    return new;
end;
$$;

drop trigger if exists preparar_estado_solicitud_al_insertar
    on public.solicitudes_alta_taller;
create trigger preparar_estado_solicitud_al_insertar
before insert on public.solicitudes_alta_taller
for each row execute function public.preparar_estado_solicitud();

drop trigger if exists publicar_solicitud_valenciana_al_insertar
    on public.solicitudes_alta_taller;
drop trigger if exists publicar_solicitud_automatica_al_insertar
    on public.solicitudes_alta_taller;
create trigger publicar_solicitud_automatica_al_insertar
after insert on public.solicitudes_alta_taller
for each row
when (new.estado = 'aprobada')
execute function public.publicar_solicitud_automatica();

drop policy if exists "visitantes pueden enviar solicitudes"
    on public.solicitudes_alta_taller;
create policy "visitantes pueden enviar solicitudes"
on public.solicitudes_alta_taller
for insert
to anon, authenticated
with check (
    estado = 'aprobada'
    and acepta_responsabilidad = true
    and acepta_terminos_at is not null
    and char_length(trim(nombre_taller)) between 2 and 120
    and char_length(trim(propietario)) between 2 and 120
    and char_length(trim(cif)) between 7 and 20
    and char_length(trim(email)) between 5 and 255
    and char_length(trim(telefono)) between 9 and 30
    and char_length(trim(direccion)) between 5 and 255
    and codigo_postal ~ '^[0-9]{5}$'
    and public.provincia_de_codigo_postal(codigo_postal) = provincia
    and char_length(trim(ciudad)) between 2 and 100
    and char_length(trim(provincia)) between 2 and 100
    and cardinality(fotos) <= 5
    and (
        cardinality(fotos) = 0
        or (
            acepta_condiciones_fotos = true
            and acepta_condiciones_fotos_at is not null
            and nullif(btrim(version_condiciones_fotos), '') is not null
        )
    )
    and char_length(trim(descripcion)) between 10 and 1500
);

-- Publica también solicitudes antiguas que todavía estuvieran pendientes.
insert into public.talleres (
    solicitud_id, nombre, propietario, cif, email, telefono, web,
    direccion, codigo_postal, ciudad, provincia, pais,
    descripcion, servicios, fotos, verificado, activo
)
select
    s.id, s.nombre_taller, s.propietario, s.cif, s.email, s.telefono, s.web,
    s.direccion, s.codigo_postal, s.ciudad, s.provincia, 'España',
    s.descripcion, s.servicios, s.fotos, false, true
from public.solicitudes_alta_taller s
where s.estado = 'pendiente'
  and not exists (
      select 1 from public.talleres t where t.solicitud_id = s.id
  )
  and not exists (
      select 1
      from public.talleres t
      where t.activo = true
        and (
            lower(coalesce(t.cif, '')) = lower(s.cif)
            or (
                lower(coalesce(t.nombre, '')) = lower(s.nombre_taller)
                and lower(coalesce(t.direccion, '')) = lower(s.direccion)
            )
        )
  );

update public.solicitudes_alta_taller
set estado = 'aprobada', revisada_at = now(), revisada_por = null
where estado = 'pendiente';

-- Ya no existe aprobación previa. El administrador conserva únicamente
-- la retirada posterior de fichas que incumplan las condiciones.
drop function if exists public.aprobar_solicitud(bigint);

create or replace function public.rechazar_solicitud(p_solicitud_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_filas integer;
begin
    if not public.es_administrador() then
        raise exception 'No autorizado' using errcode = '42501';
    end if;

    update public.solicitudes_alta_taller
    set estado = 'rechazada', revisada_at = now(), revisada_por = auth.uid()
    where id = p_solicitud_id and estado <> 'rechazada';

    get diagnostics v_filas = row_count;
    if v_filas = 0 then
        raise exception 'Ficha no encontrada o ya retirada';
    end if;

    update public.talleres
    set activo = false, updated_at = now()
    where solicitud_id = p_solicitud_id;
end;
$$;

revoke all on function public.preparar_estado_solicitud()
    from public, anon, authenticated;
revoke all on function public.publicar_solicitud_automatica()
    from public, anon, authenticated;
revoke all on function public.rechazar_solicitud(bigint) from public, anon;
grant execute on function public.rechazar_solicitud(bigint) to authenticated;

commit;

-- Comprobación opcional:
-- select estado, count(*) from public.solicitudes_alta_taller group by estado;
-- select nombre, ciudad, provincia, activo from public.talleres order by created_at desc;

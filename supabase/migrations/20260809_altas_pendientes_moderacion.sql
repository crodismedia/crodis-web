-- TallerMap: solicitudes de alta pendientes y moderación administrativa.
-- Ejecutar completo en Supabase > SQL Editor antes de desplegar la interfaz.

begin;

alter table public.solicitudes_alta_taller
    alter column estado set default 'pendiente';

-- Mantiene las validaciones y el límite antiabuso existentes, pero el estado
-- se decide siempre en el servidor y nunca provoca una publicación automática.
create or replace function public.preparar_estado_solicitud()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    v_telefono text := regexp_replace(coalesce(new.telefono, ''), '[^0-9+]', '', 'g');
begin
    if coalesce(auth.role(), '') in ('anon', 'authenticated')
       and (
            select count(*)
            from public.solicitudes_alta_taller s
            where regexp_replace(coalesce(s.telefono, ''), '[^0-9+]', '', 'g') = v_telefono
              and s.created_at > now() - interval '24 hours'
       ) >= 3 then
        raise exception 'limite_altas: demasiadas altas para este teléfono durante las últimas 24 horas'
            using errcode = 'P0001';
    end if;

    if new.localidad_verificada is not true then
        raise exception 'localidad_no_verificada: comprueba población y código postal'
            using errcode = '23514';
    end if;
    if new.acepta_privacidad is not true
       or new.acepta_privacidad_at is null
       or nullif(btrim(new.version_privacidad), '') is null then
        raise exception 'privacidad_no_aceptada'
            using errcode = '23514';
    end if;
    if new.acepta_responsabilidad is not true
       or new.acepta_terminos_at is null
       or nullif(btrim(new.version_terminos), '') is null then
        raise exception 'condiciones_no_aceptadas'
            using errcode = '23514';
    end if;
    if not public.horario_semanal_es_valido(new.horarios) then
        raise exception 'horarios_no_validos'
            using errcode = '23514';
    end if;

    new.propietario := null;
    new.cif := null;
    new.email := null;
    new.usuario_id := null;
    new.estado := 'pendiente';
    new.revisada_at := null;
    new.revisada_por := null;
    return new;
end;
$$;

drop trigger if exists preparar_estado_solicitud_al_insertar
    on public.solicitudes_alta_taller;
create trigger preparar_estado_solicitud_al_insertar
before insert on public.solicitudes_alta_taller
for each row execute function public.preparar_estado_solicitud();

-- Desactiva todas las variantes históricas de publicación al insertar.
drop trigger if exists publicar_solicitud_valenciana_al_insertar
    on public.solicitudes_alta_taller;
drop trigger if exists publicar_solicitud_automatica_al_insertar
    on public.solicitudes_alta_taller;

drop policy if exists "usuarios verificados envian solicitudes"
    on public.solicitudes_alta_taller;
drop policy if exists "visitantes pueden enviar solicitudes"
    on public.solicitudes_alta_taller;
create policy "visitantes pueden enviar solicitudes"
on public.solicitudes_alta_taller
for insert
to anon, authenticated
with check (
    usuario_id is null
    and propietario is null
    and cif is null
    and email is null
    and estado = 'pendiente'
    and localidad_verificada = true
    and acepta_privacidad = true
    and acepta_privacidad_at is not null
    and nullif(btrim(version_privacidad), '') is not null
    and acepta_responsabilidad = true
    and acepta_terminos_at is not null
    and nullif(btrim(version_terminos), '') is not null
    and char_length(btrim(nombre_taller)) between 2 and 120
    and char_length(btrim(telefono)) between 9 and 30
    and char_length(btrim(direccion)) between 5 and 255
    and codigo_postal ~ '^[0-9]{5}$'
    and char_length(btrim(ciudad)) between 2 and 100
    and char_length(btrim(provincia)) between 2 and 100
    and public.provincia_de_codigo_postal(codigo_postal) = provincia
    and public.horario_semanal_es_valido(horarios)
    and cardinality(servicios) between 1 and 49
    and cardinality(fotos) <= 5
    and (
        cardinality(fotos) = 0
        or (
            acepta_condiciones_fotos = true
            and acepta_condiciones_fotos_at is not null
            and nullif(btrim(version_condiciones_fotos), '') is not null
        )
    )
    and char_length(btrim(descripcion)) between 10 and 1500
);

drop policy if exists "administradores leen solicitudes"
    on public.solicitudes_alta_taller;
create policy "administradores leen solicitudes"
on public.solicitudes_alta_taller
for select
to authenticated
using (public.es_administrador());

-- Aprobar publica una ficha no verificada y sincroniza el catálogo relacional
-- de servicios usado por el buscador público.
create or replace function public.aprobar_solicitud(p_solicitud_id bigint)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    v_solicitud public.solicitudes_alta_taller%rowtype;
    v_taller_id uuid;
begin
    if not public.es_administrador() then
        raise exception 'No autorizado' using errcode = '42501';
    end if;

    select *
    into v_solicitud
    from public.solicitudes_alta_taller
    where id = p_solicitud_id
    for update;

    if not found then
        raise exception 'Solicitud no encontrada';
    end if;
    if v_solicitud.estado <> 'pendiente' then
        raise exception 'La solicitud ya ha sido procesada';
    end if;
    if exists (
        select 1
        from public.talleres t
        where t.solicitud_id = v_solicitud.id
    ) then
        raise exception 'La solicitud ya tiene una ficha publicada';
    end if;
    if exists (
        select 1
        from public.talleres t
        where t.activo = true
          and lower(btrim(coalesce(t.nombre, ''))) = lower(btrim(v_solicitud.nombre_taller))
          and lower(btrim(coalesce(t.direccion, ''))) = lower(btrim(v_solicitud.direccion))
    ) then
        raise exception 'duplicado: ya existe un taller con el mismo nombre y dirección'
            using errcode = '23505';
    end if;

    insert into public.talleres (
        solicitud_id, nombre, propietario, cif, email, telefono, web,
        direccion, codigo_postal, ciudad, provincia, pais,
        descripcion, horarios, servicios, fotos, verificado, activo
    ) values (
        v_solicitud.id,
        btrim(v_solicitud.nombre_taller),
        null,
        null,
        null,
        nullif(btrim(coalesce(v_solicitud.telefono, '')), ''),
        nullif(btrim(coalesce(v_solicitud.web, '')), ''),
        btrim(v_solicitud.direccion),
        v_solicitud.codigo_postal,
        btrim(v_solicitud.ciudad),
        btrim(v_solicitud.provincia),
        'España',
        btrim(v_solicitud.descripcion),
        v_solicitud.horarios,
        coalesce(v_solicitud.servicios, '{}'::text[]),
        coalesce(v_solicitud.fotos, '{}'::text[]),
        false,
        true
    )
    returning id into v_taller_id;

    insert into public.talleres_servicios (taller_id, servicio_id, confirmado)
    select v_taller_id, s.id, true
    from unnest(coalesce(v_solicitud.servicios, '{}'::text[])) as solicitado(slug)
    join public.servicios s
      on s.slug = solicitado.slug
     and coalesce(s.activo, true) = true
    on conflict (taller_id, servicio_id) do update
    set confirmado = excluded.confirmado;

    update public.solicitudes_alta_taller
    set estado = 'aprobada',
        revisada_at = now(),
        revisada_por = auth.uid()
    where id = p_solicitud_id;

    return v_taller_id;
end;
$$;

-- Rechazar solo procesa solicitudes pendientes y no modifica fichas ya publicadas.
create or replace function public.rechazar_solicitud(p_solicitud_id bigint)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    v_filas integer;
begin
    if not public.es_administrador() then
        raise exception 'No autorizado' using errcode = '42501';
    end if;

    update public.solicitudes_alta_taller
    set estado = 'rechazada',
        revisada_at = now(),
        revisada_por = auth.uid()
    where id = p_solicitud_id
      and estado = 'pendiente';

    get diagnostics v_filas = row_count;
    if v_filas = 0 then
        raise exception 'Solicitud no encontrada o ya procesada';
    end if;
end;
$$;

revoke all on function public.preparar_estado_solicitud()
    from public, anon, authenticated;
revoke all on function public.publicar_solicitud_automatica()
    from public, anon, authenticated;
revoke all on function public.publicar_solicitud_valenciana()
    from public, anon, authenticated;
revoke all on function public.aprobar_solicitud(bigint) from public, anon;
grant execute on function public.aprobar_solicitud(bigint) to authenticated;
revoke all on function public.rechazar_solicitud(bigint) from public, anon;
grant execute on function public.rechazar_solicitud(bigint) to authenticated;

revoke all on table public.solicitudes_alta_taller from anon, authenticated;
grant insert on table public.solicitudes_alta_taller to anon, authenticated;
grant select on table public.solicitudes_alta_taller to authenticated;
grant usage on sequence public.solicitudes_alta_taller_id_seq to anon, authenticated;

notify pgrst, 'reload schema';

commit;

-- Comprobaciones opcionales:
-- select estado, count(*) from public.solicitudes_alta_taller group by estado;
-- select tgname from pg_trigger where tgrelid = 'public.solicitudes_alta_taller'::regclass and not tgisinternal;

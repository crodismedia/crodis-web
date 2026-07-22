-- TallerMap: configuración completa de solicitudes, talleres, administración y RLS.
-- Ejecuta el archivo completo una sola vez en Supabase > SQL Editor.

begin;

-- Permite volver a ejecutar el archivo aunque existan versiones antiguas
-- con un tipo de retorno diferente.
drop function if exists public.aprobar_solicitud(bigint);
drop function if exists public.rechazar_solicitud(bigint);

create table if not exists public.solicitudes_alta_taller (
    id bigint generated always as identity primary key,
    nombre_taller text not null check (char_length(trim(nombre_taller)) between 2 and 120),
    propietario text not null check (char_length(trim(propietario)) between 2 and 120),
    cif text not null check (char_length(trim(cif)) between 7 and 20),
    email text not null check (char_length(trim(email)) between 5 and 255),
    telefono text not null check (char_length(trim(telefono)) between 9 and 30),
    web text,
    direccion text not null check (char_length(trim(direccion)) between 5 and 255),
    codigo_postal text not null check (codigo_postal ~ '^[0-9]{5}$'),
    ciudad text not null check (char_length(trim(ciudad)) between 2 and 100),
    provincia text not null check (char_length(trim(provincia)) between 2 and 100),
    servicios text[] not null default '{}',
    fotos text[] not null default '{}',
    descripcion text not null check (char_length(trim(descripcion)) between 10 and 1500),
    estado text not null default 'aprobada' check (estado in ('pendiente', 'aprobada', 'rechazada')),
    acepta_responsabilidad boolean not null default false,
    acepta_terminos_at timestamptz,
    version_terminos text,
    acepta_condiciones_fotos boolean not null default false,
    acepta_condiciones_fotos_at timestamptz,
    version_condiciones_fotos text,
    revisada_at timestamptz,
    revisada_por uuid,
    created_at timestamptz not null default now()
);

-- Completa instalaciones anteriores sin borrar solicitudes existentes.
alter table public.solicitudes_alta_taller add column if not exists servicios text[] not null default '{}';
alter table public.solicitudes_alta_taller add column if not exists fotos text[] not null default '{}';
alter table public.solicitudes_alta_taller add column if not exists web text;
alter table public.solicitudes_alta_taller add column if not exists acepta_responsabilidad boolean not null default false;
alter table public.solicitudes_alta_taller add column if not exists acepta_terminos_at timestamptz;
alter table public.solicitudes_alta_taller add column if not exists version_terminos text;
alter table public.solicitudes_alta_taller add column if not exists acepta_condiciones_fotos boolean not null default false;
alter table public.solicitudes_alta_taller add column if not exists acepta_condiciones_fotos_at timestamptz;
alter table public.solicitudes_alta_taller add column if not exists version_condiciones_fotos text;
alter table public.solicitudes_alta_taller add column if not exists revisada_at timestamptz;
alter table public.solicitudes_alta_taller add column if not exists revisada_por uuid;

create index if not exists solicitudes_estado_created_idx
    on public.solicitudes_alta_taller (estado, created_at);

create table if not exists public.talleres (
    id uuid primary key default gen_random_uuid(),
    solicitud_id bigint,
    nombre text not null,
    propietario text,
    cif text,
    email text,
    telefono text,
    movil text,
    whatsapp text,
    direccion text,
    codigo_postal text,
    ciudad text,
    provincia text,
    pais text not null default 'España',
    latitud double precision,
    longitud double precision,
    descripcion text,
    web text,
    facebook text,
    instagram text,
    linkedin text,
    horario text,
    logo text,
    portada text,
    servicios text[] not null default '{}',
    fotos text[] not null default '{}',
    verificado boolean not null default false,
    activo boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Completa una tabla talleres ya existente sin cambiar sus datos actuales.
alter table public.talleres add column if not exists solicitud_id bigint;
alter table public.talleres add column if not exists nombre text;
alter table public.talleres add column if not exists propietario text;
alter table public.talleres add column if not exists cif text;
alter table public.talleres add column if not exists email text;
alter table public.talleres add column if not exists telefono text;
alter table public.talleres add column if not exists movil text;
alter table public.talleres add column if not exists whatsapp text;
alter table public.talleres add column if not exists direccion text;
alter table public.talleres add column if not exists codigo_postal text;
alter table public.talleres add column if not exists ciudad text;
alter table public.talleres add column if not exists provincia text;
alter table public.talleres add column if not exists pais text default 'España';
alter table public.talleres add column if not exists latitud double precision;
alter table public.talleres add column if not exists longitud double precision;
alter table public.talleres add column if not exists descripcion text;
alter table public.talleres add column if not exists web text;
alter table public.talleres add column if not exists facebook text;
alter table public.talleres add column if not exists instagram text;
alter table public.talleres add column if not exists linkedin text;
alter table public.talleres add column if not exists horario text;
alter table public.talleres add column if not exists logo text;
alter table public.talleres add column if not exists portada text;
alter table public.talleres add column if not exists servicios text[] not null default '{}';
alter table public.talleres add column if not exists fotos text[] not null default '{}';
alter table public.talleres add column if not exists verificado boolean not null default false;
alter table public.talleres add column if not exists activo boolean not null default true;
alter table public.talleres add column if not exists created_at timestamptz not null default now();
alter table public.talleres add column if not exists updated_at timestamptz not null default now();

-- Los dos primeros dígitos del código postal identifican la provincia.
create or replace function public.provincia_de_codigo_postal(p_codigo_postal text)
returns text
language sql
immutable
strict
set search_path = public, pg_temp
as $$
    select case left(p_codigo_postal, 2)
        when '01' then 'Araba/Álava' when '02' then 'Albacete'
        when '03' then 'Alicante/Alacant' when '04' then 'Almería'
        when '05' then 'Ávila' when '06' then 'Badajoz'
        when '07' then 'Illes Balears' when '08' then 'Barcelona'
        when '09' then 'Burgos' when '10' then 'Cáceres'
        when '11' then 'Cádiz' when '12' then 'Castellón/Castelló'
        when '13' then 'Ciudad Real' when '14' then 'Córdoba'
        when '15' then 'A Coruña' when '16' then 'Cuenca'
        when '17' then 'Girona' when '18' then 'Granada'
        when '19' then 'Guadalajara' when '20' then 'Gipuzkoa'
        when '21' then 'Huelva' when '22' then 'Huesca'
        when '23' then 'Jaén' when '24' then 'León'
        when '25' then 'Lleida' when '26' then 'La Rioja'
        when '27' then 'Lugo' when '28' then 'Madrid'
        when '29' then 'Málaga' when '30' then 'Murcia'
        when '31' then 'Navarra' when '32' then 'Ourense'
        when '33' then 'Asturias' when '34' then 'Palencia'
        when '35' then 'Las Palmas' when '36' then 'Pontevedra'
        when '37' then 'Salamanca' when '38' then 'Santa Cruz de Tenerife'
        when '39' then 'Cantabria' when '40' then 'Segovia'
        when '41' then 'Sevilla' when '42' then 'Soria'
        when '43' then 'Tarragona' when '44' then 'Teruel'
        when '45' then 'Toledo' when '46' then 'Valencia/València'
        when '47' then 'Valladolid' when '48' then 'Bizkaia'
        when '49' then 'Zamora' when '50' then 'Zaragoza'
        when '51' then 'Ceuta' when '52' then 'Melilla'
        else null
    end;
$$;

alter table public.solicitudes_alta_taller
    drop constraint if exists solicitudes_provincia_codigo_postal_coinciden;
alter table public.solicitudes_alta_taller
    add constraint solicitudes_provincia_codigo_postal_coinciden
    check (
        public.provincia_de_codigo_postal(codigo_postal) is not null
        and public.provincia_de_codigo_postal(codigo_postal) = provincia
    )
    not valid;

alter table public.solicitudes_alta_taller
    drop constraint if exists solicitudes_web_url_valida;
alter table public.solicitudes_alta_taller
    add constraint solicitudes_web_url_valida
    check (web is null or btrim(web) = '' or web ~* '^https?://[^[:space:]]+$')
    not valid;

alter table public.talleres
    drop constraint if exists talleres_provincia_codigo_postal_coinciden;
alter table public.talleres
    add constraint talleres_provincia_codigo_postal_coinciden
    check (
        codigo_postal is null
        or provincia is null
        or (
            public.provincia_de_codigo_postal(codigo_postal) is not null
            and public.provincia_de_codigo_postal(codigo_postal) = provincia
        )
    )
    not valid;

alter table public.talleres
    drop constraint if exists talleres_web_url_valida;
alter table public.talleres
    add constraint talleres_web_url_valida
    check (web is null or btrim(web) = '' or web ~* '^https?://[^[:space:]]+$')
    not valid;

alter table public.solicitudes_alta_taller
    drop constraint if exists solicitudes_maximo_cinco_fotos;
alter table public.solicitudes_alta_taller
    add constraint solicitudes_maximo_cinco_fotos
    check (
        cardinality(fotos) <= 5
        and (
            cardinality(fotos) = 0
            or (
                acepta_condiciones_fotos = true
                and acepta_condiciones_fotos_at is not null
                and nullif(btrim(version_condiciones_fotos), '') is not null
            )
        )
    )
    not valid;

alter table public.talleres
    drop constraint if exists talleres_maximo_cinco_fotos;
alter table public.talleres
    add constraint talleres_maximo_cinco_fotos
    check (cardinality(fotos) <= 5)
    not valid;

create unique index if not exists talleres_solicitud_id_unica
    on public.talleres (solicitud_id)
    where solicitud_id is not null;
create index if not exists talleres_publicos_ubicacion_idx
    on public.talleres (activo, provincia, ciudad, codigo_postal);
create index if not exists talleres_servicios_gin_idx
    on public.talleres using gin (servicios);

-- Todas las solicitudes se publican automáticamente como no verificadas.
-- El estado se decide en el servidor para que el visitante no pueda elegirlo.
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

create or replace function public.publicar_solicitud_valenciana()
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
create trigger publicar_solicitud_valenciana_al_insertar
after insert on public.solicitudes_alta_taller
for each row
when (new.estado = 'aprobada')
execute function public.publicar_solicitud_valenciana();

create table if not exists public.administradores (
    user_id uuid primary key references auth.users(id) on delete cascade,
    created_at timestamptz not null default now()
);

create or replace function public.es_administrador()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select exists (
        select 1
        from public.administradores
        where user_id = auth.uid()
    );
$$;

create or replace function public.puede_subir_foto_solicitud(p_ruta text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select
        p_ruta ~ '^solicitudes/[0-9a-f-]{36}/[0-9]{2}-[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'
        and exists (
            select 1
            from public.solicitudes_alta_taller s
            where p_ruta = any(s.fotos)
              and s.acepta_condiciones_fotos = true
              and s.acepta_condiciones_fotos_at is not null
        );
$$;

alter table public.solicitudes_alta_taller enable row level security;
alter table public.talleres enable row level security;
alter table public.administradores enable row level security;

drop policy if exists "visitantes pueden enviar solicitudes" on public.solicitudes_alta_taller;
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

drop policy if exists "administradores leen solicitudes" on public.solicitudes_alta_taller;
create policy "administradores leen solicitudes"
on public.solicitudes_alta_taller
for select
to authenticated
using (public.es_administrador());

drop policy if exists "publico consulta talleres activos" on public.talleres;
create policy "publico consulta talleres activos"
on public.talleres
for select
to anon, authenticated
using (activo = true);

drop policy if exists "administradores consultan todos los talleres" on public.talleres;
create policy "administradores consultan todos los talleres"
on public.talleres
for select
to authenticated
using (public.es_administrador());

drop policy if exists "administradores ven su propia asignacion" on public.administradores;
create policy "administradores ven su propia asignacion"
on public.administradores
for select
to authenticated
using (user_id = auth.uid());

-- Las fotografías se guardan en un bucket privado. Solo una solicitud que
-- haya declarado previamente la ruta puede subir el archivo correspondiente.
insert into storage.buckets (
    id, name, public, file_size_limit, allowed_mime_types
) values (
    'fotos-talleres', 'fotos-talleres', false, 5242880,
    array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "solicitudes suben sus fotos autorizadas" on storage.objects;
create policy "solicitudes suben sus fotos autorizadas"
on storage.objects
for insert
to anon, authenticated
with check (
    bucket_id = 'fotos-talleres'
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
    and public.puede_subir_foto_solicitud(name)
);

drop policy if exists "publico ve fotos de talleres activos" on storage.objects;
create policy "publico ve fotos de talleres activos"
on storage.objects
for select
to anon, authenticated
using (
    bucket_id = 'fotos-talleres'
    and exists (
        select 1
        from public.talleres t
        where t.activo = true
          and name = any(t.fotos)
    )
);

drop policy if exists "administradores ven fotos de solicitudes" on storage.objects;
create policy "administradores ven fotos de solicitudes"
on storage.objects
for select
to authenticated
using (
    bucket_id = 'fotos-talleres'
    and public.es_administrador()
);

create or replace function public.aprobar_solicitud(p_solicitud_id bigint)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
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
        where t.activo = true
          and (
              lower(coalesce(t.cif, '')) = lower(v_solicitud.cif)
              or (
                  lower(coalesce(t.nombre, '')) = lower(v_solicitud.nombre_taller)
                  and lower(coalesce(t.direccion, '')) = lower(v_solicitud.direccion)
              )
          )
    ) then
        raise exception 'duplicado: ya existe un taller con el mismo CIF o nombre y dirección';
    end if;

    select id into v_taller_id
    from public.talleres
    where solicitud_id = p_solicitud_id
    limit 1;

    if v_taller_id is null then
        insert into public.talleres (
            solicitud_id, nombre, propietario, cif, email, telefono, web,
            direccion, codigo_postal, ciudad, provincia, pais,
            descripcion, servicios, fotos, verificado, activo
        ) values (
            v_solicitud.id, v_solicitud.nombre_taller, v_solicitud.propietario,
            v_solicitud.cif, v_solicitud.email, v_solicitud.telefono, v_solicitud.web,
            v_solicitud.direccion, v_solicitud.codigo_postal, v_solicitud.ciudad,
            v_solicitud.provincia, 'España', v_solicitud.descripcion,
            v_solicitud.servicios, v_solicitud.fotos, true, true
        )
        returning id into v_taller_id;
    else
        update public.talleres
        set nombre = v_solicitud.nombre_taller,
            propietario = v_solicitud.propietario,
            cif = v_solicitud.cif,
            email = v_solicitud.email,
            telefono = v_solicitud.telefono,
            web = v_solicitud.web,
            direccion = v_solicitud.direccion,
            codigo_postal = v_solicitud.codigo_postal,
            ciudad = v_solicitud.ciudad,
            provincia = v_solicitud.provincia,
            descripcion = v_solicitud.descripcion,
            servicios = v_solicitud.servicios,
            fotos = v_solicitud.fotos,
            verificado = true,
            activo = true,
            updated_at = now()
        where id = v_taller_id;
    end if;

    update public.solicitudes_alta_taller
    set estado = 'aprobada',
        revisada_at = now(),
        revisada_por = auth.uid()
    where id = p_solicitud_id;

    return v_taller_id;
end;
$$;

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
    set estado = 'rechazada',
        revisada_at = now(),
        revisada_por = auth.uid()
    where id = p_solicitud_id
      and estado <> 'rechazada';

    get diagnostics v_filas = row_count;
    if v_filas = 0 then
        raise exception 'Ficha no encontrada o ya retirada';
    end if;

    update public.talleres
    set activo = false,
        updated_at = now()
    where solicitud_id = p_solicitud_id;
end;
$$;

-- Contadores públicos calculados únicamente con talleres activos.
create or replace function public.estadisticas_publicas()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select jsonb_build_object(
        'talleres_activos', count(*),
        'provincias_disponibles', count(distinct nullif(trim(t.provincia), '')),
        'servicios_disponibles', (
            select count(distinct s.servicio)
            from public.talleres ts
            cross join lateral unnest(coalesce(ts.servicios, '{}'::text[])) as s(servicio)
            where ts.activo = true
              and nullif(trim(s.servicio), '') is not null
        )
    )
    from public.talleres t
    where t.activo = true;
$$;

revoke all on table public.solicitudes_alta_taller from anon, authenticated;
grant insert on table public.solicitudes_alta_taller to anon, authenticated;
grant select on table public.solicitudes_alta_taller to authenticated;
grant usage on sequence public.solicitudes_alta_taller_id_seq to anon, authenticated;

revoke insert, update, delete on table public.talleres from anon, authenticated;
grant select on table public.talleres to anon, authenticated;

grant select on table public.administradores to authenticated;

revoke all on function public.es_administrador() from public, anon;
grant execute on function public.es_administrador() to authenticated;
drop function if exists public.aprobar_solicitud(bigint);
revoke all on function public.rechazar_solicitud(bigint) from public, anon;
grant execute on function public.rechazar_solicitud(bigint) to authenticated;
revoke all on function public.estadisticas_publicas() from public;
grant execute on function public.estadisticas_publicas() to anon, authenticated;
revoke all on function public.puede_subir_foto_solicitud(text) from public;
grant execute on function public.puede_subir_foto_solicitud(text) to anon, authenticated;
revoke all on function public.preparar_estado_solicitud() from public, anon, authenticated;
revoke all on function public.publicar_solicitud_valenciana() from public, anon, authenticated;

commit;

-- Después de crear un usuario en Authentication > Users, conviértelo en administrador:
-- insert into public.administradores (user_id) values ('UUID-DEL-USUARIO');

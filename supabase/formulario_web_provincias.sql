-- TallerMap: web opcional y validación provincia/código postal.
-- Ejecuta el archivo completo en Supabase > SQL Editor.

begin;

alter table public.solicitudes_alta_taller add column if not exists web text;
alter table public.solicitudes_alta_taller add column if not exists fotos text[] not null default '{}';
alter table public.solicitudes_alta_taller add column if not exists acepta_condiciones_fotos boolean not null default false;
alter table public.solicitudes_alta_taller add column if not exists acepta_condiciones_fotos_at timestamptz;
alter table public.solicitudes_alta_taller add column if not exists version_condiciones_fotos text;
alter table public.talleres add column if not exists web text;
alter table public.talleres add column if not exists fotos text[] not null default '{}';

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

    select * into v_solicitud
    from public.solicitudes_alta_taller
    where id = p_solicitud_id
    for update;

    if not found then raise exception 'Solicitud no encontrada'; end if;
    if v_solicitud.estado <> 'pendiente' then
        raise exception 'La solicitud ya ha sido procesada';
    end if;

    if exists (
        select 1 from public.talleres t
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
    set estado = 'aprobada', revisada_at = now(), revisada_por = auth.uid()
    where id = p_solicitud_id;

    return v_taller_id;
end;
$$;

commit;

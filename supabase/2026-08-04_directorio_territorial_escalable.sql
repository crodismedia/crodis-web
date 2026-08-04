-- TallerMap: directorio escalable provincia -> municipio -> taller.
-- Migración no destructiva: no elimina talleres, rutas ni funciones existentes.
-- Ejecutar completa en Supabase > SQL Editor.

begin;

create or replace function public.directorio_normalizar(valor text)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
    select regexp_replace(
        translate(
            lower(btrim(coalesce(valor, ''))),
            'áàäâãåéèëêíìïîóòöôõúùüûñç',
            'aaaaaaeeeeiiiiooooouuuunc'
        ),
        '[^a-z0-9]+',
        ' ',
        'g'
    );
$$;

create or replace function public.directorio_slug(valor text)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
    select trim(both '-' from regexp_replace(
        replace(public.directorio_normalizar(valor), ' ', '-'),
        '-+',
        '-',
        'g'
    ));
$$;

create or replace function public.directorio_codigo_provincia(valor text)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
    select case
        when public.directorio_normalizar(valor) like '%alicante%'
          or public.directorio_normalizar(valor) like '%alacant%' then '03'
        when public.directorio_normalizar(valor) like '%castellon%'
          or public.directorio_normalizar(valor) like '%castello%' then '12'
        when public.directorio_normalizar(valor) like '%valencia%' then '46'
        else null
    end;
$$;

alter table public.talleres
    add column if not exists slug text;

update public.talleres
set slug = public.directorio_slug(
        concat_ws('-', coalesce(nombre, 'taller'), coalesce(ciudad, ''))
    ) || '-' || left(id::text, 8)
where nullif(btrim(coalesce(slug, '')), '') is null;

create unique index if not exists talleres_slug_unico_idx
    on public.talleres (slug)
    where slug is not null;

create index if not exists talleres_directorio_provincia_idx
    on public.talleres (
        (coalesce(nullif(left(codigo_postal, 2), ''), public.directorio_codigo_provincia(provincia))),
        (public.directorio_normalizar(ciudad)),
        (public.directorio_normalizar(nombre))
    )
    where activo = true;

create or replace function public.preparar_slug_taller()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
    if nullif(btrim(coalesce(new.slug, '')), '') is null then
        new.slug := public.directorio_slug(
            concat_ws('-', coalesce(new.nombre, 'taller'), coalesce(new.ciudad, ''))
        ) || '-' || left(new.id::text, 8);
    end if;
    return new;
end;
$$;

drop trigger if exists preparar_slug_taller_al_guardar on public.talleres;
create trigger preparar_slug_taller_al_guardar
before insert or update of nombre, ciudad, slug on public.talleres
for each row execute function public.preparar_slug_taller();

create or replace function public.listar_municipios_publicos(p_provincia text)
returns table (
    codigo_municipal text,
    municipio text,
    total_talleres bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    with parametros as (
        select public.directorio_codigo_provincia(p_provincia) as codigo
    ),
    catalogo as (
        select m.codigo_municipal, m.nombre
        from public.municipios m
        cross join parametros p
        where m.activo = true
          and left(m.codigo_municipal, 2) = p.codigo
    )
    select
        c.codigo_municipal,
        c.nombre as municipio,
        count(distinct t.id) as total_talleres
    from catalogo c
    join public.talleres t
      on t.activo = true
     and coalesce(
            nullif(left(t.codigo_postal, 2), ''),
            public.directorio_codigo_provincia(t.provincia)
         ) = left(c.codigo_municipal, 2)
     and exists (
            select 1
            from unnest(string_to_array(c.nombre, '/')) as alias(nombre)
            where public.directorio_normalizar(alias.nombre)
                = public.directorio_normalizar(t.ciudad)
         )
    group by c.codigo_municipal, c.nombre
    having count(distinct t.id) > 0
    order by public.directorio_normalizar(c.nombre), c.codigo_municipal;
$$;

create or replace function public.buscar_talleres_provincia(
    p_provincia text,
    p_desde integer default 0,
    p_limite integer default 30
)
returns table (
    id uuid,
    slug text,
    nombre text,
    telefono text,
    web text,
    direccion text,
    codigo_postal text,
    ciudad text,
    provincia text,
    descripcion text,
    verificado boolean,
    servicios text[],
    fotos text[],
    horarios jsonb,
    updated_at timestamptz,
    total_resultados bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    with parametros as (
        select public.directorio_codigo_provincia(p_provincia) as codigo
    ),
    filtrados as (
        select t.*
        from public.talleres t
        cross join parametros p
        where t.activo = true
          and p.codigo is not null
          and coalesce(
                nullif(left(t.codigo_postal, 2), ''),
                public.directorio_codigo_provincia(t.provincia)
              ) = p.codigo
    ),
    contados as (
        select f.*, count(*) over () as total_resultados
        from filtrados f
    )
    select
        c.id, c.slug, c.nombre, c.telefono, c.web, c.direccion,
        c.codigo_postal, c.ciudad, c.provincia, c.descripcion,
        c.verificado, coalesce(c.servicios, '{}'::text[]),
        coalesce(c.fotos, '{}'::text[]), c.horarios, c.updated_at,
        c.total_resultados
    from contados c
    order by public.directorio_normalizar(c.nombre), c.id
    offset greatest(coalesce(p_desde, 0), 0)
    limit least(greatest(coalesce(p_limite, 30), 1), 100);
$$;

create or replace function public.buscar_talleres_municipio(
    p_codigo_municipal text,
    p_servicio text default '',
    p_desde integer default 0,
    p_limite integer default 30
)
returns table (
    id uuid,
    slug text,
    nombre text,
    telefono text,
    web text,
    direccion text,
    codigo_postal text,
    ciudad text,
    provincia text,
    descripcion text,
    verificado boolean,
    servicios text[],
    fotos text[],
    horarios jsonb,
    updated_at timestamptz,
    total_resultados bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    with municipio_objetivo as (
        select m.codigo_municipal, m.nombre
        from public.municipios m
        where m.activo = true
          and m.codigo_municipal = p_codigo_municipal
        limit 1
    ),
    filtrados as (
        select t.*
        from public.talleres t
        join municipio_objetivo m
          on coalesce(
                nullif(left(t.codigo_postal, 2), ''),
                public.directorio_codigo_provincia(t.provincia)
             ) = left(m.codigo_municipal, 2)
         and exists (
                select 1
                from unnest(string_to_array(m.nombre, '/')) as alias(nombre)
                where public.directorio_normalizar(alias.nombre)
                    = public.directorio_normalizar(t.ciudad)
             )
        where t.activo = true
          and (
                nullif(btrim(coalesce(p_servicio, '')), '') is null
                or btrim(p_servicio) = any(coalesce(t.servicios, '{}'::text[]))
              )
    ),
    contados as (
        select f.*, count(*) over () as total_resultados
        from filtrados f
    )
    select
        c.id, c.slug, c.nombre, c.telefono, c.web, c.direccion,
        c.codigo_postal, c.ciudad, c.provincia, c.descripcion,
        c.verificado, coalesce(c.servicios, '{}'::text[]),
        coalesce(c.fotos, '{}'::text[]), c.horarios, c.updated_at,
        c.total_resultados
    from contados c
    order by public.directorio_normalizar(c.nombre), c.id
    offset greatest(coalesce(p_desde, 0), 0)
    limit least(greatest(coalesce(p_limite, 30), 1), 100);
$$;

create or replace function public.obtener_taller_publico(
    p_id uuid default null,
    p_slug text default null
)
returns table (
    id uuid,
    slug text,
    nombre text,
    telefono text,
    web text,
    direccion text,
    codigo_postal text,
    ciudad text,
    provincia text,
    descripcion text,
    verificado boolean,
    servicios text[],
    fotos text[],
    horarios jsonb,
    updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select
        t.id, t.slug, t.nombre, t.telefono, t.web, t.direccion,
        t.codigo_postal, t.ciudad, t.provincia, t.descripcion,
        t.verificado, coalesce(t.servicios, '{}'::text[]),
        coalesce(t.fotos, '{}'::text[]), t.horarios, t.updated_at
    from public.talleres t
    where t.activo = true
      and (
            (p_id is not null and t.id = p_id)
            or (p_slug is not null and t.slug = p_slug)
          )
    order by case when p_id is not null and t.id = p_id then 0 else 1 end
    limit 1;
$$;

revoke all on function public.directorio_normalizar(text) from public;
revoke all on function public.directorio_slug(text) from public;
revoke all on function public.directorio_codigo_provincia(text) from public;
revoke all on function public.listar_municipios_publicos(text) from public;
revoke all on function public.buscar_talleres_provincia(text, integer, integer) from public;
revoke all on function public.buscar_talleres_municipio(text, text, integer, integer) from public;
revoke all on function public.obtener_taller_publico(uuid, text) from public;

grant execute on function public.listar_municipios_publicos(text) to anon, authenticated;
grant execute on function public.buscar_talleres_provincia(text, integer, integer) to anon, authenticated;
grant execute on function public.buscar_talleres_municipio(text, text, integer, integer) to anon, authenticated;
grant execute on function public.obtener_taller_publico(uuid, text) to anon, authenticated;

commit;

-- Comprobaciones opcionales:
-- select * from public.listar_municipios_publicos('Castellón');
-- select * from public.buscar_talleres_provincia('Valencia', 0, 30);
-- select * from public.buscar_talleres_municipio('46230', '', 0, 30);

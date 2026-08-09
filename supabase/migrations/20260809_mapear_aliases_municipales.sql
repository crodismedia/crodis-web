-- TallerMap: relaciona pedanías, núcleos y variantes bilingües con su municipio.
-- Conserva la ciudad visible del taller y no modifica ni elimina fichas.

begin;

create table if not exists public.municipio_aliases (
    codigo_provincia text not null
        check (codigo_provincia in ('03', '12', '46')),
    alias text not null,
    alias_normalizado text generated always as (
        public.directorio_normalizar(alias)
    ) stored,
    codigo_municipal text not null
        references public.municipios(codigo_municipal) on update cascade,
    created_at timestamptz not null default now(),
    primary key (codigo_provincia, alias_normalizado),
    check (left(codigo_municipal, 2) = codigo_provincia)
);

alter table public.municipio_aliases enable row level security;
revoke all on table public.municipio_aliases
    from public, anon, authenticated;

insert into public.municipio_aliases (
    codigo_provincia,
    alias,
    codigo_municipal
)
values
    -- Alicante/Alacant: pedanías, urbanizaciones y variantes locales.
    ('03', 'Torrellano', '03065'),
    ('03', 'Orihuela Costa', '03099'),
    ('03', 'Moraira', '03128'),
    ('03', 'Calpe', '03047'),
    ('03', 'El Altet', '03065'),
    ('03', 'Albir', '03011'),
    ('03', 'Ciudad Quesada', '03113'),
    ('03', 'La Marina', '03065'),
    ('03', 'El Bacarot', '03014'),
    ('03', 'L''Almadrava', '03050'),
    ('03', 'La Xara', '03063'),
    ('03', 'Los Palacios', '03070'),
    ('03', 'San Bartolomé', '03099'),
    ('03', 'Torre de la Horadada', '03902'),
    ('03', 'Villamartín', '03099'),

    -- Castellón/Castelló: núcleos costeros y nombres bilingües completos.
    ('12', 'Orpesa/Oropesa del Mar', '12085'),
    ('12', 'Llucena/Lucena del Cid', '12072'),
    ('12', 'El Grau de Castelló', '12040'),
    ('12', 'La Vall d''Alba', '12124'),
    ('12', 'les Alqueries/Alquerías del Niño Perdido', '12901'),
    ('12', 'Peníscola/Peñíscola', '12089'),
    ('12', 'Alcossebre', '12004'),
    ('12', 'Els Ibarsos', '12105'),
    ('12', 'Castelló De La Plana/Castellón De La Plana', '12040'),
    ('12', 'Chilches/Xilxes', '12053'),
    ('12', 'El Grao de Castellón', '12040'),
    ('12', 'El Grau de Moncofa', '12077'),
    ('12', 'Segona del Riu (Morella)', '12080'),

    -- Valencia/València: pedanías, barrios y variantes bilingües.
    ('46', 'Puerto de Sagunto', '46220'),
    ('46', 'El Port de Sagunt', '46220'),
    ('46', 'Port de Sagunt', '46220'),
    ('46', 'El Perelló', '46235'),
    ('46', 'Benimàmet', '46250'),
    ('46', 'Alfarp', '46026'),
    ('46', 'Castellar-Oliveral', '46250'),
    ('46', 'Cogullada', '46083'),
    ('46', 'El Marenyet', '46105'),
    ('46', 'La Barraca d’Aigües Vives', '46017'),
    ('46', 'La Canyada', '46190'),
    ('46', 'Los Pajares', '46092'),
    ('46', 'Montortal', '46019'),
    ('46', 'Real de Montroi', '46212')
on conflict (codigo_provincia, alias_normalizado)
do update set
    alias = excluded.alias,
    codigo_municipal = excluded.codigo_municipal;

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
    catalogo_aliases as materialized (
        select distinct
            m.codigo_municipal,
            m.nombre,
            p.codigo as codigo_provincia,
            public.directorio_normalizar(alias.nombre) as municipio_normalizado
        from public.municipios m
        cross join parametros p
        cross join lateral unnest(string_to_array(m.nombre, '/')) as alias(nombre)
        where m.activo = true
          and left(m.codigo_municipal, 2) = p.codigo

        union

        select
            m.codigo_municipal,
            m.nombre,
            a.codigo_provincia,
            a.alias_normalizado
        from public.municipio_aliases a
        join public.municipios m
          on m.codigo_municipal = a.codigo_municipal
         and m.activo = true
        cross join parametros p
        where a.codigo_provincia = p.codigo
    )
    select
        c.codigo_municipal,
        c.nombre as municipio,
        count(distinct t.id) as total_talleres
    from catalogo_aliases c
    join public.talleres t
      on t.activo = true
     and coalesce(
            nullif(left(t.codigo_postal, 2), ''),
            public.directorio_codigo_provincia(t.provincia)
         ) = c.codigo_provincia
     and public.directorio_normalizar(t.ciudad) = c.municipio_normalizado
    group by c.codigo_municipal, c.nombre
    having count(distinct t.id) > 0
    order by public.directorio_normalizar(c.nombre), c.codigo_municipal;
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
    with municipio_aliases_objetivo as materialized (
        select distinct
            left(m.codigo_municipal, 2) as codigo_provincia,
            public.directorio_normalizar(alias.nombre) as municipio_normalizado
        from public.municipios m
        cross join lateral unnest(string_to_array(m.nombre, '/')) as alias(nombre)
        where m.activo = true
          and m.codigo_municipal = p_codigo_municipal

        union

        select
            a.codigo_provincia,
            a.alias_normalizado
        from public.municipio_aliases a
        join public.municipios m
          on m.codigo_municipal = a.codigo_municipal
         and m.activo = true
        where a.codigo_municipal = p_codigo_municipal
    ),
    filtrados as (
        select t.*
        from municipio_aliases_objetivo m
        join public.talleres t
          on t.activo = true
         and coalesce(
                nullif(left(t.codigo_postal, 2), ''),
                public.directorio_codigo_provincia(t.provincia)
             ) = m.codigo_provincia
         and public.directorio_normalizar(t.ciudad) = m.municipio_normalizado
        where nullif(btrim(coalesce(p_servicio, '')), '') is null
           or btrim(p_servicio) = any(coalesce(t.servicios, '{}'::text[]))
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

revoke all on function public.listar_municipios_publicos(text) from public;
revoke all on function public.buscar_talleres_municipio(text, text, integer, integer)
    from public;

grant execute on function public.listar_municipios_publicos(text)
    to anon, authenticated;
grant execute on function public.buscar_talleres_municipio(text, text, integer, integer)
    to anon, authenticated;

notify pgrst, 'reload schema';

commit;

-- Comprobaciones opcionales después de ejecutar:
-- La suma de los tres resultados debe ser 5.008.
-- select sum(total_talleres) from public.listar_municipios_publicos('Alicante/Alacant');
-- select sum(total_talleres) from public.listar_municipios_publicos('Castellón/Castelló');
-- select sum(total_talleres) from public.listar_municipios_publicos('Valencia/València');

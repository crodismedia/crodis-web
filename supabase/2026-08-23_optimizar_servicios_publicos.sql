CREATE OR REPLACE FUNCTION public.normalizar_servicios_array(p_servicios text[])
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
    SELECT COALESCE(
        array_agg(DISTINCT public.normalizar_busqueda(valor) ORDER BY public.normalizar_busqueda(valor))
            FILTER (WHERE NULLIF(public.normalizar_busqueda(valor), '') IS NOT NULL),
        '{}'::text[]
    )
    FROM unnest(COALESCE(p_servicios, '{}'::text[])) AS s(valor);
$$;

ALTER TABLE public.talleres
ADD COLUMN IF NOT EXISTS servicios_busqueda_norm text[]
GENERATED ALWAYS AS (public.normalizar_servicios_array(servicios)) STORED;

CREATE INDEX IF NOT EXISTS talleres_servicios_busqueda_norm_gin_idx
ON public.talleres
USING gin (servicios_busqueda_norm)
WHERE activo = true;

DROP INDEX IF EXISTS public.talleres_servicios_norm_gin_idx;

CREATE OR REPLACE FUNCTION public.buscar_talleres_servicio_publico(
    p_servicio text,
    p_desde integer DEFAULT 0,
    p_limite integer DEFAULT 30
)
RETURNS TABLE(
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
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
    WITH objetivo AS (
        SELECT
            s.id,
            public.normalizar_busqueda(p_servicio) AS servicio_norm
        FROM public.servicios s
        WHERE s.slug = btrim(coalesce(p_servicio, ''))
          AND coalesce(s.activo, true) = true
        LIMIT 1
    ),
    candidatos AS MATERIALIZED (
        SELECT t.id
        FROM public.talleres t
        CROSS JOIN objetivo o
        WHERE t.activo = true
          AND t.servicios_busqueda_norm @> ARRAY[o.servicio_norm]::text[]

        UNION

        SELECT ts.taller_id
        FROM public.talleres_servicios ts
        CROSS JOIN objetivo o
        JOIN public.talleres t
          ON t.id = ts.taller_id
         AND t.activo = true
        WHERE ts.servicio_id = o.id
    ),
    total AS (
        SELECT count(*)::bigint AS total_resultados
        FROM candidatos
    ),
    pagina AS (
        SELECT
            t.id,
            t.slug,
            t.nombre,
            t.telefono,
            t.web,
            t.direccion,
            t.codigo_postal::text,
            t.ciudad,
            t.provincia,
            t.descripcion,
            coalesce(t.verificado, false) AS verificado,
            coalesce(t.servicios, '{}'::text[]) AS servicios,
            coalesce(t.fotos, '{}'::text[]) AS fotos,
            t.horarios,
            t.updated_at
        FROM candidatos c
        JOIN public.talleres t ON t.id = c.id
        ORDER BY t.ciudad, t.nombre, t.id
        OFFSET greatest(coalesce(p_desde, 0), 0)
        LIMIT least(greatest(coalesce(p_limite, 30), 1), 100)
    )
    SELECT
        p.id,
        p.slug,
        p.nombre,
        p.telefono,
        p.web,
        p.direccion,
        p.codigo_postal,
        p.ciudad,
        p.provincia,
        p.descripcion,
        p.verificado,
        p.servicios,
        p.fotos,
        p.horarios,
        p.updated_at,
        t.total_resultados
    FROM pagina p
    CROSS JOIN total t;
$$;

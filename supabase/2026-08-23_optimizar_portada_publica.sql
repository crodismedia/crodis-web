CREATE OR REPLACE FUNCTION public.listar_talleres_portada_publica(p_limite integer DEFAULT 24)
RETURNS TABLE(
    id uuid,
    nombre text,
    direccion text,
    codigo_postal text,
    ciudad text,
    provincia text,
    telefono text,
    slug text,
    verificado boolean,
    horarios jsonb,
    fotos text[],
    coincidencia integer
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
    SELECT
        t.id,
        t.nombre,
        t.direccion,
        t.codigo_postal::text,
        t.ciudad,
        t.provincia,
        t.telefono,
        t.slug,
        coalesce(t.verificado, false),
        t.horarios,
        coalesce(t.fotos, '{}'::text[]),
        CASE WHEN t.busqueda_cp_norm = '' THEN 100 ELSE 70 END
    FROM public.talleres t
    WHERE t.activo = true
    ORDER BY
        CASE WHEN t.busqueda_cp_norm = '' THEN 100 ELSE 70 END DESC,
        t.ciudad,
        t.nombre
    LIMIT least(greatest(coalesce(p_limite, 24), 1), 50);
$$;

CREATE OR REPLACE FUNCTION public.buscar_talleres_profesional_con_horarios(
    p_ubicacion text DEFAULT NULL::text,
    p_servicio text DEFAULT NULL::text,
    p_limite integer DEFAULT 20,
    p_desde integer DEFAULT 0
)
RETURNS TABLE(
    id uuid,
    nombre text,
    direccion text,
    codigo_postal text,
    ciudad text,
    provincia text,
    telefono text,
    slug text,
    verificado boolean,
    horarios jsonb,
    coincidencia integer,
    total_resultados bigint
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
    WITH parametros AS (
        SELECT
            coalesce(btrim(p_ubicacion), '') AS ubicacion,
            coalesce(btrim(p_servicio), '') AS servicio,
            greatest(coalesce(p_desde, 0), 0) AS desde
    ),
    total_portada AS (
        SELECT count(*)::bigint AS total_resultados
        FROM public.talleres
        WHERE activo = true
    ),
    salida AS (
        SELECT
            p.id,
            p.nombre,
            p.direccion,
            p.codigo_postal,
            p.ciudad,
            p.provincia,
            p.telefono,
            p.slug,
            p.verificado,
            p.horarios,
            p.coincidencia,
            t.total_resultados
        FROM public.listar_talleres_portada_publica(p_limite) p
        CROSS JOIN total_portada t
        CROSS JOIN parametros x
        WHERE x.ubicacion = ''
          AND x.servicio = ''
          AND x.desde = 0

        UNION ALL

        SELECT
            b.id,
            b.nombre,
            b.direccion,
            b.codigo_postal,
            b.ciudad,
            b.provincia,
            b.telefono,
            b.slug,
            b.verificado,
            t.horarios,
            b.coincidencia,
            b.total_resultados
        FROM public.buscar_talleres_profesional(
            p_ubicacion,
            p_servicio,
            p_limite,
            p_desde
        ) b
        JOIN public.talleres t ON t.id = b.id
        CROSS JOIN parametros x
        WHERE NOT (
            x.ubicacion = ''
            AND x.servicio = ''
            AND x.desde = 0
        )
    )
    SELECT *
    FROM salida
    ORDER BY coincidencia DESC, ciudad, nombre;
$$;

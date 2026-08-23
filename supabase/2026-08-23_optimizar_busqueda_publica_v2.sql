CREATE OR REPLACE FUNCTION public.normalizar_variantes_ciudad(p_ciudad text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
    SELECT COALESCE(
        array_agg(DISTINCT variante ORDER BY variante),
        '{}'::text[]
    )
    FROM (
        SELECT public.normalizar_busqueda(coalesce(p_ciudad, '')) AS variante
        UNION ALL
        SELECT public.normalizar_busqueda(parte)
        FROM unnest(string_to_array(coalesce(p_ciudad, ''), '/')) AS x(parte)
    ) q
    WHERE NULLIF(variante, '') IS NOT NULL;
$$;

ALTER TABLE public.talleres
ADD COLUMN IF NOT EXISTS ciudad_busqueda_variantes text[]
GENERATED ALWAYS AS (public.normalizar_variantes_ciudad(ciudad)) STORED;

CREATE INDEX IF NOT EXISTS talleres_ciudad_variantes_gin_idx
ON public.talleres
USING gin (ciudad_busqueda_variantes)
WHERE activo = true;

CREATE OR REPLACE FUNCTION public.buscar_talleres_profesional_v2(
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
    coincidencia integer,
    total_resultados bigint
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
WITH entrada AS (
  SELECT
    public.normalizar_busqueda(p_ubicacion) AS ubicacion_norm,
    btrim(coalesce(p_servicio, '')) AS servicio_original,
    public.normalizar_busqueda(p_servicio) AS servicio_original_norm,
    public.directorio_codigo_provincia(p_ubicacion) AS provincia_cod
),
params AS (
  SELECT
    ubicacion_norm,
    CASE
      WHEN servicio_original IN ('cambio-de-aceite', 'cambio-aceite-filtros')
        OR servicio_original_norm IN ('cambio de aceite', 'cambio aceite filtros')
      THEN 'cambio-aceite-filtros'
      ELSE servicio_original
    END AS servicio_raw,
    public.normalizar_busqueda(
      CASE
        WHEN servicio_original IN ('cambio-de-aceite', 'cambio-aceite-filtros')
          OR servicio_original_norm IN ('cambio de aceite', 'cambio aceite filtros')
        THEN 'cambio-aceite-filtros'
        ELSE servicio_original
      END
    ) AS servicio_norm,
    provincia_cod
  FROM entrada
),
municipio_objetivo AS (
  SELECT DISTINCT m.codigo_municipal
  FROM public.municipios m
  CROSS JOIN params p
  WHERE m.activo = true
    AND p.ubicacion_norm <> ''
    AND (
      EXISTS (
        SELECT 1
        FROM unnest(string_to_array(m.nombre, '/')) AS parte(nombre)
        WHERE public.normalizar_busqueda(parte.nombre) = p.ubicacion_norm
      )
      OR EXISTS (
        SELECT 1
        FROM public.municipio_aliases ma
        WHERE ma.codigo_municipal = m.codigo_municipal
          AND public.normalizar_busqueda(ma.alias) = p.ubicacion_norm
      )
    )
),
ciudades_equivalentes AS (
  SELECT ubicacion_norm AS norm
  FROM params
  WHERE ubicacion_norm <> ''
  UNION
  SELECT public.normalizar_busqueda(parte.nombre)
  FROM public.municipios m
  JOIN municipio_objetivo mo ON mo.codigo_municipal = m.codigo_municipal
  CROSS JOIN LATERAL unnest(string_to_array(m.nombre, '/')) AS parte(nombre)
  UNION
  SELECT public.normalizar_busqueda(ma.alias)
  FROM public.municipio_aliases ma
  JOIN municipio_objetivo mo ON mo.codigo_municipal = ma.codigo_municipal
),
equivalentes AS (
  SELECT coalesce(array_agg(norm), '{}'::text[]) AS arr
  FROM ciudades_equivalentes
),
servicios_objetivo AS (
  SELECT s.id
  FROM public.servicios s
  CROSS JOIN params p
  WHERE p.servicio_norm <> ''
    AND coalesce(s.activo, true) = true
    AND (
      s.slug = p.servicio_raw
      OR s.nombre = p.servicio_raw
      OR public.normalizar_busqueda(s.slug) = p.servicio_norm
      OR public.normalizar_busqueda(s.nombre) = p.servicio_norm
    )
),
ubicacion_raw AS MATERIALIZED (
  SELECT
    t.id,
    CASE
      WHEN t.busqueda_cp_norm = '' THEN 100
      WHEN t.busqueda_provincia_norm IS NOT NULL THEN 70
      ELSE 50
    END AS score
  FROM public.talleres t
  CROSS JOIN params p
  WHERE t.activo = true
    AND p.ubicacion_norm = ''

  UNION ALL

  SELECT t.id, 100
  FROM public.talleres t
  CROSS JOIN params p
  WHERE t.activo = true
    AND p.ubicacion_norm <> ''
    AND t.busqueda_cp_norm = p.ubicacion_norm

  UNION ALL

  SELECT t.id, 90
  FROM public.talleres t
  CROSS JOIN params p
  CROSS JOIN equivalentes e
  WHERE t.activo = true
    AND p.ubicacion_norm <> ''
    AND t.ciudad_busqueda_variantes && e.arr

  UNION ALL

  SELECT t.id, 70
  FROM public.talleres t
  CROSS JOIN params p
  WHERE t.activo = true
    AND p.ubicacion_norm <> ''
    AND p.provincia_cod IS NOT NULL
    AND t.directorio_provincia_cod = p.provincia_cod

  UNION ALL

  SELECT t.id, 70
  FROM public.talleres t
  CROSS JOIN params p
  WHERE t.activo = true
    AND p.ubicacion_norm <> ''
    AND t.busqueda_provincia_norm LIKE '%' || p.ubicacion_norm || '%'
),
ubicacion AS (
  SELECT id, max(score)::integer AS coincidencia
  FROM ubicacion_raw
  GROUP BY id
),
servicio AS MATERIALIZED (
  SELECT t.id
  FROM public.talleres t
  CROSS JOIN params p
  WHERE t.activo = true
    AND p.servicio_norm <> ''
    AND t.servicios_busqueda_norm @> ARRAY[p.servicio_norm]::text[]

  UNION

  SELECT ts.taller_id
  FROM public.talleres_servicios ts
  CROSS JOIN servicios_objetivo so
  JOIN public.talleres t
    ON t.id = ts.taller_id
   AND t.activo = true
  WHERE ts.servicio_id = so.id
),
candidatos AS (
  SELECT u.id, u.coincidencia
  FROM ubicacion u
  CROSS JOIN params p
  WHERE p.servicio_norm = ''

  UNION ALL

  SELECT u.id, u.coincidencia
  FROM ubicacion u
  JOIN servicio s ON s.id = u.id
  CROSS JOIN params p
  WHERE p.servicio_norm <> ''
),
resultados AS (
  SELECT
    t.id,
    t.nombre,
    t.direccion,
    t.codigo_postal::text,
    t.ciudad,
    t.provincia,
    t.telefono,
    t.slug,
    coalesce(t.verificado, false) AS verificado,
    c.coincidencia,
    count(*) OVER() AS total_resultados
  FROM candidatos c
  JOIN public.talleres t ON t.id = c.id
)
SELECT
  r.id,
  r.nombre,
  r.direccion,
  r.codigo_postal,
  r.ciudad,
  r.provincia,
  r.telefono,
  r.slug,
  r.verificado,
  r.coincidencia,
  r.total_resultados
FROM resultados r
ORDER BY r.coincidencia DESC, r.ciudad, r.nombre
LIMIT greatest(1, least(coalesce(p_limite, 20), 50))
OFFSET greatest(coalesce(p_desde, 0), 0);
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
        FROM public.buscar_talleres_profesional_v2(
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

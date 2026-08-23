CREATE OR REPLACE FUNCTION public.listar_municipios_sitemap()
RETURNS TABLE(codigo_municipal text, municipio text, updated_at timestamptz)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
WITH publicados AS MATERIALIZED (
  SELECT * FROM public.listar_municipios_publicos('Alicante')
  UNION ALL
  SELECT * FROM public.listar_municipios_publicos('Castellón')
  UNION ALL
  SELECT * FROM public.listar_municipios_publicos('Valencia')
),
formas AS MATERIALIZED (
  SELECT
    p.codigo_municipal,
    p.municipio,
    left(p.codigo_municipal, 2) AS codigo_provincia,
    public.directorio_normalizar(p.municipio) AS municipio_normalizado
  FROM publicados p

  UNION

  SELECT
    p.codigo_municipal,
    p.municipio,
    left(p.codigo_municipal, 2),
    public.directorio_normalizar(parte.nombre)
  FROM publicados p
  CROSS JOIN LATERAL unnest(string_to_array(p.municipio, '/')) AS parte(nombre)

  UNION

  SELECT
    p.codigo_municipal,
    p.municipio,
    left(p.codigo_municipal, 2),
    a.alias_normalizado
  FROM publicados p
  JOIN public.municipio_aliases a
    ON a.codigo_municipal = p.codigo_municipal
)
SELECT
  f.codigo_municipal,
  f.municipio,
  max(t.updated_at) AS updated_at
FROM formas f
JOIN public.talleres t
  ON t.activo = true
 AND t.directorio_provincia_cod = f.codigo_provincia
 AND t.directorio_ciudad_norm = f.municipio_normalizado
WHERE nullif(f.municipio_normalizado, '') IS NOT NULL
GROUP BY f.codigo_municipal, f.municipio
ORDER BY public.directorio_normalizar(f.municipio), f.codigo_municipal;
$$;

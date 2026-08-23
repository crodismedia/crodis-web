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

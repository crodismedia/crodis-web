CREATE TABLE IF NOT EXISTS public.taller_slug_aliases (
  old_slug text PRIMARY KEY,
  taller_id uuid NOT NULL REFERENCES public.talleres(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT taller_slug_aliases_old_slug_formato CHECK (old_slug ~ '^[a-z0-9-]+$')
);

CREATE INDEX IF NOT EXISTS taller_slug_aliases_taller_id_idx
  ON public.taller_slug_aliases(taller_id);

ALTER TABLE public.taller_slug_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.taller_slug_aliases FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.guardar_alias_slug_taller()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF old.slug IS DISTINCT FROM new.slug
     AND nullif(btrim(old.slug), '') IS NOT NULL THEN
    INSERT INTO public.taller_slug_aliases(old_slug, taller_id)
    VALUES (lower(btrim(old.slug)), new.id)
    ON CONFLICT (old_slug) DO UPDATE
      SET taller_id = excluded.taller_id;
  END IF;
  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION public.guardar_alias_slug_taller() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS talleres_guardar_alias_slug ON public.talleres;
CREATE TRIGGER talleres_guardar_alias_slug
AFTER UPDATE OF slug ON public.talleres
FOR EACH ROW
WHEN (old.slug IS DISTINCT FROM new.slug)
EXECUTE FUNCTION public.guardar_alias_slug_taller();

CREATE OR REPLACE FUNCTION public.resolver_slug_taller_publico(p_slug text)
RETURNS TABLE(canonical_slug text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT t.slug::text
  FROM public.taller_slug_aliases a
  JOIN public.talleres t ON t.id = a.taller_id
  WHERE a.old_slug = lower(btrim(coalesce(p_slug, '')))
    AND t.activo = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolver_slug_taller_publico(text) FROM public;
GRANT EXECUTE ON FUNCTION public.resolver_slug_taller_publico(text) TO anon, authenticated;

INSERT INTO public.taller_slug_aliases(old_slug, taller_id)
SELECT 'julio-orti-s-l-morella-65b15ed8', t.id
FROM public.talleres t
WHERE t.slug = 'talleres-julio-orti-segona-del-riu-morella-98805fa6'
ON CONFLICT (old_slug) DO UPDATE
SET taller_id = excluded.taller_id;

CREATE OR REPLACE FUNCTION public.obtener_taller_publico(
  p_id uuid DEFAULT null::uuid,
  p_slug text DEFAULT null::text
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
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_slug text := nullif(btrim(coalesce(p_slug, '')), '');
BEGIN
  IF p_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      t.id,
      t.slug,
      t.nombre,
      t.telefono,
      t.web,
      t.direccion,
      t.codigo_postal,
      t.ciudad,
      t.provincia,
      t.descripcion,
      coalesce(t.verificado, false),
      coalesce(t.servicios, '{}'::text[]),
      coalesce(t.fotos, '{}'::text[]),
      t.horarios,
      t.updated_at
    FROM public.talleres t
    WHERE t.activo = true
      AND t.id = p_id
    LIMIT 1;

    IF found THEN
      RETURN;
    END IF;
  END IF;

  IF v_slug IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.slug,
    t.nombre,
    t.telefono,
    t.web,
    t.direccion,
    t.codigo_postal,
    t.ciudad,
    t.provincia,
    t.descripcion,
    coalesce(t.verificado, false),
    coalesce(t.servicios, '{}'::text[]),
    coalesce(t.fotos, '{}'::text[]),
    t.horarios,
    t.updated_at
  FROM public.talleres t
  WHERE t.activo = true
    AND t.slug = v_slug
  LIMIT 1;

  IF found THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    t.id,
    t.slug,
    t.nombre,
    t.telefono,
    t.web,
    t.direccion,
    t.codigo_postal,
    t.ciudad,
    t.provincia,
    t.descripcion,
    coalesce(t.verificado, false),
    coalesce(t.servicios, '{}'::text[]),
    coalesce(t.fotos, '{}'::text[]),
    t.horarios,
    t.updated_at
  FROM public.resolver_slug_taller_publico(v_slug) r
  JOIN public.talleres t ON t.slug = r.canonical_slug
  WHERE t.activo = true
  LIMIT 1;
END;
$$;

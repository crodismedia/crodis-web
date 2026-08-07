create or replace function public.aplicar_autocompletado_seguro_admin(
    p_taller_id uuid,
    p_cambios jsonb
)
returns public.talleres
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    v_taller public.talleres%rowtype;
    v_claves text[];
    v_clave text;
begin
    if auth.uid() is null or not public.es_administrador() then
        raise exception 'administrador_requerido' using errcode = '42501';
    end if;

    if p_cambios is null or jsonb_typeof(p_cambios) <> 'object' then
        raise exception 'cambios_invalidos' using errcode = '22023';
    end if;

    select array_agg(key order by key)
      into v_claves
      from jsonb_object_keys(p_cambios) as key;

    if coalesce(array_length(v_claves, 1), 0) = 0 then
        raise exception 'sin_cambios' using errcode = '22023';
    end if;

    foreach v_clave in array v_claves loop
        if v_clave not in ('provincia', 'telefono', 'web') then
            raise exception 'campo_no_permitido: %', v_clave using errcode = '22023';
        end if;
    end loop;

    select *
      into v_taller
      from public.talleres
     where id = p_taller_id
     for update;

    if not found then
        raise exception 'taller_no_encontrado' using errcode = 'P0002';
    end if;

    update public.talleres
       set provincia = case
            when p_cambios ? 'provincia' then nullif(btrim(p_cambios->>'provincia'), '')
            else provincia
           end,
           telefono = case
            when p_cambios ? 'telefono' then nullif(btrim(p_cambios->>'telefono'), '')
            else telefono
           end,
           web = case
            when p_cambios ? 'web' then nullif(btrim(p_cambios->>'web'), '')
            else web
           end
     where id = p_taller_id
     returning * into v_taller;

    return v_taller;
end;
$$;

revoke all on function public.aplicar_autocompletado_seguro_admin(uuid, jsonb) from public, anon;
grant execute on function public.aplicar_autocompletado_seguro_admin(uuid, jsonb) to authenticated;

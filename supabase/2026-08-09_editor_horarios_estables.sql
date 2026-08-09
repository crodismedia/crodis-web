-- TallerMap: unifica la validación de horarios y el guardado del editor administrativo.
-- Ejecutar este archivo COMPLETO en Supabase > SQL Editor.
-- Fecha: 2026-08-09

begin;

create or replace function public.horario_semanal_es_valido(p_horarios jsonb)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
    v_dias constant text[] := array[
        'lunes','martes','miercoles','jueves','viernes','sabado','domingo'
    ];
    v_numero_claves integer;
    v_dia text;
    v_horario jsonb;
    v_turnos jsonb;
    v_turno jsonb;
    v_apertura text;
    v_cierre text;
    v_apertura_min integer;
    v_cierre_min integer;
    v_cierre_anterior integer;
    v_hay_dia_abierto boolean := false;
begin
    if p_horarios is null or jsonb_typeof(p_horarios) <> 'object' then
        return false;
    end if;

    select count(*)
    into v_numero_claves
    from jsonb_object_keys(p_horarios);

    if v_numero_claves <> 7
       or not (p_horarios ?& v_dias) then
        return false;
    end if;

    foreach v_dia in array v_dias loop
        v_horario := p_horarios -> v_dia;

        if v_horario is null or jsonb_typeof(v_horario) <> 'object' then
            return false;
        end if;

        if jsonb_typeof(v_horario -> 'cerrado') <> 'boolean' then
            return false;
        end if;

        if (v_horario ->> 'cerrado')::boolean then
            if not (v_horario ? 'turnos')
               or jsonb_typeof(v_horario -> 'turnos') <> 'array'
               or jsonb_array_length(v_horario -> 'turnos') <> 0 then
                return false;
            end if;
            continue;
        end if;

        v_hay_dia_abierto := true;
        v_turnos := v_horario -> 'turnos';

        if v_turnos is null
           or jsonb_typeof(v_turnos) <> 'array'
           or jsonb_array_length(v_turnos) not between 1 and 2 then
            return false;
        end if;

        v_cierre_anterior := null;

        for v_turno in
            select value
            from jsonb_array_elements(v_turnos)
        loop
            if jsonb_typeof(v_turno) <> 'object' then
                return false;
            end if;

            v_apertura := btrim(coalesce(v_turno ->> 'apertura', ''));
            v_cierre := btrim(coalesce(v_turno ->> 'cierre', ''));

            if v_apertura !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
                return false;
            end if;

            if v_cierre !~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$' then
                return false;
            end if;

            v_apertura_min := split_part(v_apertura, ':', 1)::integer * 60
                            + split_part(v_apertura, ':', 2)::integer;

            v_cierre_min := case
                when v_cierre = '24:00' then 1440
                else split_part(v_cierre, ':', 1)::integer * 60
                   + split_part(v_cierre, ':', 2)::integer
            end;

            if v_cierre_min <= v_apertura_min then
                return false;
            end if;

            if v_cierre_anterior is not null
               and v_apertura_min < v_cierre_anterior then
                return false;
            end if;

            v_cierre_anterior := v_cierre_min;
        end loop;
    end loop;

    return v_hay_dia_abierto;
end;
$$;

grant execute on function public.horario_semanal_es_valido(jsonb)
    to anon, authenticated;

create or replace function public.admin_actualizar_taller_editor(
    p_taller_id uuid,
    p_nombre text,
    p_telefono text,
    p_web text,
    p_direccion text,
    p_codigo_postal text,
    p_ciudad text,
    p_provincia text,
    p_descripcion text,
    p_servicios text[],
    p_horarios jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    v_id uuid;
    v_nombre text := nullif(btrim(coalesce(p_nombre, '')), '');
    v_telefono text := nullif(btrim(coalesce(p_telefono, '')), '');
    v_web text := nullif(btrim(coalesce(p_web, '')), '');
    v_direccion text := nullif(btrim(coalesce(p_direccion, '')), '');
    v_codigo_postal text := nullif(btrim(coalesce(p_codigo_postal, '')), '');
    v_ciudad text := nullif(btrim(coalesce(p_ciudad, '')), '');
    v_provincia text := nullif(btrim(coalesce(p_provincia, '')), '');
    v_descripcion text := nullif(btrim(coalesce(p_descripcion, '')), '');
    v_servicios text[] := coalesce(p_servicios, array[]::text[]);
begin
    if not public.es_administrador() then
        raise exception 'No autorizado' using errcode = '42501';
    end if;

    if p_taller_id is null then
        raise exception 'taller_id_no_valido' using errcode = '23514';
    end if;

    if v_nombre is null or char_length(v_nombre) not between 2 and 120 then
        raise exception 'nombre_no_valido' using errcode = '23514';
    end if;

    if v_telefono is not null and char_length(v_telefono) not between 9 and 30 then
        raise exception 'telefono_no_valido' using errcode = '23514';
    end if;

    if v_web is not null and v_web !~* '^https?://[^[:space:]]+$' then
        raise exception 'web_no_valida' using errcode = '23514';
    end if;

    if v_direccion is not null and char_length(v_direccion) not between 5 and 255 then
        raise exception 'direccion_no_valida' using errcode = '23514';
    end if;

    if v_codigo_postal is not null and v_codigo_postal !~ '^[0-9]{5}$' then
        raise exception 'codigo_postal_no_valido' using errcode = '23514';
    end if;

    if v_ciudad is not null and char_length(v_ciudad) not between 2 and 100 then
        raise exception 'ciudad_no_valida' using errcode = '23514';
    end if;

    if v_provincia is not null and char_length(v_provincia) not between 2 and 100 then
        raise exception 'provincia_no_valida' using errcode = '23514';
    end if;

    if p_horarios is not null and not public.horario_semanal_es_valido(p_horarios) then
        raise exception 'horarios_no_validos' using errcode = '23514';
    end if;

    if cardinality(v_servicios) > 49 then
        raise exception 'servicios_no_validos' using errcode = '23514';
    end if;

    if v_descripcion is not null and char_length(v_descripcion) not between 10 and 1500 then
        raise exception 'descripcion_no_valida' using errcode = '23514';
    end if;

    update public.talleres
    set nombre = v_nombre,
        telefono = v_telefono,
        web = v_web,
        direccion = v_direccion,
        codigo_postal = v_codigo_postal,
        ciudad = v_ciudad,
        provincia = v_provincia,
        descripcion = v_descripcion,
        servicios = v_servicios,
        horarios = p_horarios,
        updated_at = now()
    where id = p_taller_id
    returning id into v_id;

    if v_id is null then
        raise exception 'Taller no encontrado';
    end if;

    return v_id;
end;
$$;

revoke all on function public.admin_actualizar_taller_editor(
    uuid, text, text, text, text, text, text, text, text, text[], jsonb
) from public, anon;

grant execute on function public.admin_actualizar_taller_editor(
    uuid, text, text, text, text, text, text, text, text, text[], jsonb
) to authenticated;

notify pgrst, 'reload schema';

commit;

-- PRUEBA OPCIONAL DESPUÉS DE EJECUTAR:
-- select public.horario_semanal_es_valido(
--   '{
--      "lunes":{"cerrado":false,"turnos":[{"apertura":"09:00","cierre":"13:30"},{"apertura":"15:30","cierre":"19:00"}]},
--      "martes":{"cerrado":false,"turnos":[{"apertura":"09:00","cierre":"18:00"}]},
--      "miercoles":{"cerrado":false,"turnos":[{"apertura":"09:00","cierre":"18:00"}]},
--      "jueves":{"cerrado":false,"turnos":[{"apertura":"09:00","cierre":"18:00"}]},
--      "viernes":{"cerrado":false,"turnos":[{"apertura":"09:00","cierre":"18:00"}]},
--      "sabado":{"cerrado":true,"turnos":[]},
--      "domingo":{"cerrado":true,"turnos":[]}
--    }'::jsonb
-- );
-- Debe devolver true.

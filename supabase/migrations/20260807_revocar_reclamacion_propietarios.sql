-- TallerMap · Fase 8: revocación segura de accesos de propietarios
-- Ejecutar una sola vez en Supabase SQL Editor.

begin;

alter table public.reclamaciones_taller
    add column if not exists revoked_at timestamptz,
    add column if not exists revoked_by uuid references auth.users(id) on delete set null;

alter table public.reclamaciones_taller
    drop constraint if exists reclamaciones_taller_estado_chk;

alter table public.reclamaciones_taller
    add constraint reclamaciones_taller_estado_chk
    check (estado in ('pendiente','aprobada','rechazada','revocada'));

create or replace function public.revocar_reclamacion_taller(
    p_reclamacion_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
    v_reclamacion public.reclamaciones_taller%rowtype;
    v_propietario uuid;
begin
    if auth.uid() is null or not public.es_administrador() then
        raise exception 'administrador_requerido' using errcode = '42501';
    end if;

    select *
      into v_reclamacion
      from public.reclamaciones_taller
     where id = p_reclamacion_id
     for update;

    if not found then
        raise exception 'reclamacion_no_encontrada' using errcode = 'P0002';
    end if;

    if v_reclamacion.estado <> 'aprobada' then
        raise exception 'solo_reclamaciones_aprobadas' using errcode = '23514';
    end if;

    select usuario_id
      into v_propietario
      from public.taller_propietarios
     where taller_id = v_reclamacion.taller_id
     for update;

    if not found then
        raise exception 'asociacion_propietario_no_encontrada' using errcode = 'P0002';
    end if;

    if v_propietario <> v_reclamacion.usuario_id then
        raise exception 'asociacion_propietario_no_coincide' using errcode = '23514';
    end if;

    delete from public.taller_propietarios
     where taller_id = v_reclamacion.taller_id
       and usuario_id = v_reclamacion.usuario_id;

    update public.reclamaciones_taller
       set estado = 'revocada',
           revoked_at = now(),
           revoked_by = auth.uid()
     where id = p_reclamacion_id;

    if to_regclass('public.registro_actividad') is not null then
        insert into public.registro_actividad (
            taller_id,
            usuario_id,
            accion,
            origen,
            datos_anteriores,
            datos_nuevos,
            campos_modificados
        ) values (
            v_reclamacion.taller_id,
            auth.uid(),
            'revocar_reclamacion',
            'administracion',
            jsonb_build_object(
                'reclamacion_id', v_reclamacion.id,
                'estado', 'aprobada',
                'usuario_id', v_reclamacion.usuario_id
            ),
            jsonb_build_object(
                'reclamacion_id', v_reclamacion.id,
                'estado', 'revocada',
                'usuario_id', v_reclamacion.usuario_id
            ),
            array['estado','taller_propietarios']::text[]
        );
    end if;

    return 'revocada';
end;
$$;

revoke all on function public.revocar_reclamacion_taller(uuid)
    from public, anon;
grant execute on function public.revocar_reclamacion_taller(uuid)
    to authenticated;

commit;

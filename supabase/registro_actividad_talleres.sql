-- TallerMap: registro inmutable de cambios en public.talleres.
-- Ejecutar en Supabase > SQL Editor.

begin;

create table if not exists public.registro_actividad (
    id bigint generated always as identity primary key,
    taller_id uuid references public.talleres(id) on delete set null,
    usuario_id uuid references auth.users(id) on delete set null,
    accion text not null,
    origen text not null default 'base_datos',
    datos_anteriores jsonb,
    datos_nuevos jsonb,
    campos_modificados text[] not null default '{}',
    creado_at timestamptz not null default now()
);

create index if not exists registro_actividad_taller_fecha_idx
    on public.registro_actividad (taller_id, creado_at desc);
create index if not exists registro_actividad_usuario_fecha_idx
    on public.registro_actividad (usuario_id, creado_at desc);

alter table public.registro_actividad enable row level security;

drop policy if exists "administradores consultan registro actividad"
    on public.registro_actividad;
create policy "administradores consultan registro actividad"
on public.registro_actividad
for select
to authenticated
using (public.es_administrador());

revoke insert, update, delete on public.registro_actividad from anon, authenticated;
grant select on public.registro_actividad to authenticated;

create or replace function public.registrar_cambio_taller()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_antes jsonb;
    v_despues jsonb;
    v_campos text[];
begin
    if tg_op = 'INSERT' then
        v_despues := to_jsonb(new);
        insert into public.registro_actividad (
            taller_id, usuario_id, accion, origen,
            datos_anteriores, datos_nuevos, campos_modificados
        ) values (
            new.id, auth.uid(), 'crear_taller', 'trigger_talleres',
            null, v_despues, array(select jsonb_object_keys(v_despues))
        );
        return new;
    end if;

    if tg_op = 'DELETE' then
        v_antes := to_jsonb(old);
        insert into public.registro_actividad (
            taller_id, usuario_id, accion, origen,
            datos_anteriores, datos_nuevos, campos_modificados
        ) values (
            old.id, auth.uid(), 'eliminar_taller', 'trigger_talleres',
            v_antes, null, array(select jsonb_object_keys(v_antes))
        );
        return old;
    end if;

    v_antes := to_jsonb(old);
    v_despues := to_jsonb(new);

    select coalesce(array_agg(clave order by clave), '{}')
    into v_campos
    from (
        select key as clave
        from jsonb_each(v_despues)
        where v_antes -> key is distinct from v_despues -> key
    ) cambios;

    if cardinality(v_campos) > 0 then
        insert into public.registro_actividad (
            taller_id, usuario_id, accion, origen,
            datos_anteriores, datos_nuevos, campos_modificados
        ) values (
            new.id, auth.uid(), 'actualizar_taller', 'trigger_talleres',
            v_antes, v_despues, v_campos
        );
    end if;

    return new;
end;
$$;

drop trigger if exists trg_registrar_cambio_taller on public.talleres;
create trigger trg_registrar_cambio_taller
after insert or update or delete on public.talleres
for each row execute function public.registrar_cambio_taller();

revoke all on function public.registrar_cambio_taller() from public;

commit;

-- Comprobación:
-- select id, taller_id, usuario_id, accion, campos_modificados, creado_at
-- from public.registro_actividad
-- order by creado_at desc
-- limit 50;

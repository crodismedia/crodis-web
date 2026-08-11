begin;

create or replace function public.admin_borrar_talleres_editor_v4(p_taller_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_borradas integer;
begin
  if not public.es_administrador() then
    raise exception 'No autorizado' using errcode='42501';
  end if;
  if p_taller_ids is null or cardinality(p_taller_ids)=0 then
    raise exception 'seleccion_vacia' using errcode='22023';
  end if;
  if cardinality(p_taller_ids)>100 then
    raise exception 'maximo_100_fichas' using errcode='22023';
  end if;

  delete from public.talleres
  where id=any(p_taller_ids);
  get diagnostics v_borradas = row_count;
  return v_borradas;
end;
$$;

revoke all on function public.admin_borrar_talleres_editor_v4(uuid[]) from public, anon, authenticated;
grant execute on function public.admin_borrar_talleres_editor_v4(uuid[]) to authenticated;

commit;

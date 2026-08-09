-- TallerMap: unifica las variantes de la provincia de Castellón.
-- Canon oficial interno: Castellón/Castelló (código postal 12xxx).

begin;

create or replace function public.normalizar_provincia_castellon()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
    v_codigo_postal text := btrim(coalesce(new.codigo_postal, ''));
    v_provincia text := public.normalizar_busqueda(new.provincia);
begin
    if left(v_codigo_postal, 2) = '12'
       or (
            (v_codigo_postal = '' or v_codigo_postal !~ '^[0-9]{5}$')
            and v_provincia in (
                'castellon', 'castello',
                'castellon castello', 'castello castellon'
            )
       ) then
        new.provincia := 'Castellón/Castelló';
    end if;
    return new;
end;
$$;

drop trigger if exists aa_normalizar_provincia_castellon
    on public.talleres;
create trigger aa_normalizar_provincia_castellon
before insert or update of provincia, codigo_postal on public.talleres
for each row execute function public.normalizar_provincia_castellon();

drop trigger if exists aa_normalizar_provincia_castellon
    on public.solicitudes_alta_taller;
create trigger aa_normalizar_provincia_castellon
before insert or update of provincia, codigo_postal on public.solicitudes_alta_taller
for each row execute function public.normalizar_provincia_castellon();

-- Corrige los talleres con CP 12xxx y las variantes inequívocas sin CP.
update public.talleres
set provincia = 'Castellón/Castelló',
    updated_at = now()
where provincia is distinct from 'Castellón/Castelló'
  and (
      left(btrim(coalesce(codigo_postal, '')), 2) = '12'
      or (
          (btrim(coalesce(codigo_postal, '')) = ''
           or btrim(codigo_postal) !~ '^[0-9]{5}$')
          and public.normalizar_busqueda(provincia) in (
              'castellon', 'castello',
              'castellon castello', 'castello castellon'
          )
      )
  );

-- Conserva el mismo canon en el histórico y en las solicitudes pendientes.
update public.solicitudes_alta_taller
set provincia = 'Castellón/Castelló'
where provincia is distinct from 'Castellón/Castelló'
  and (
      left(btrim(coalesce(codigo_postal, '')), 2) = '12'
      or (
          (btrim(coalesce(codigo_postal, '')) = ''
           or btrim(codigo_postal) !~ '^[0-9]{5}$')
          and public.normalizar_busqueda(provincia) in (
              'castellon', 'castello',
              'castellon castello', 'castello castellon'
          )
      )
  );

revoke all on function public.normalizar_provincia_castellon()
    from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;

-- Comprobaciones opcionales después de ejecutar:
-- select provincia, count(*) from public.talleres
-- where public.normalizar_busqueda(provincia) like 'castell%'
-- group by provincia order by provincia;
-- select count(*) as cp_12_con_provincia_incorrecta from public.talleres
-- where left(btrim(coalesce(codigo_postal, '')), 2) = '12'
--   and provincia is distinct from 'Castellón/Castelló';

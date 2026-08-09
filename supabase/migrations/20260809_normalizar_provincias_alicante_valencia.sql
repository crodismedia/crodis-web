-- TallerMap: unifica Alicante/Alacant y Valencia/València.
-- Sustituye la regla específica de Castellón por un único canon preventivo
-- para las tres provincias de la Comunitat Valenciana.

begin;

drop trigger if exists aa_normalizar_provincia_castellon
    on public.talleres;
drop trigger if exists aa_normalizar_provincia_castellon
    on public.solicitudes_alta_taller;
drop function if exists public.normalizar_provincia_castellon();

create or replace function public.provincia_canonica_comunitat_valenciana(
    p_codigo_postal text,
    p_provincia text
)
returns text
language sql
immutable
parallel safe
set search_path = public, pg_temp
as $$
    with valores as (
        select
            btrim(coalesce(p_codigo_postal, '')) as codigo_postal,
            public.normalizar_busqueda(p_provincia) as provincia
    )
    select case
        when left(codigo_postal, 2) = '03' then 'Alicante/Alacant'
        when left(codigo_postal, 2) = '12' then 'Castellón/Castelló'
        when left(codigo_postal, 2) = '46' then 'Valencia/València'
        when codigo_postal = '' or codigo_postal !~ '^[0-9]{5}$' then
            case
                when provincia in (
                    'alicante', 'alacant',
                    'alicante alacant', 'alacant alicante'
                ) then 'Alicante/Alacant'
                when provincia in (
                    'castellon', 'castello',
                    'castellon castello', 'castello castellon'
                ) then 'Castellón/Castelló'
                when provincia in (
                    'valencia', 'valencia valencia'
                ) then 'Valencia/València'
                else null
            end
        else null
    end
    from valores;
$$;

create or replace function public.normalizar_provincia_comunitat_valenciana()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_provincia text;
begin
    v_provincia := public.provincia_canonica_comunitat_valenciana(
        new.codigo_postal,
        new.provincia
    );
    if v_provincia is not null then
        new.provincia := v_provincia;
    end if;
    return new;
end;
$$;

drop trigger if exists aa_normalizar_provincia_comunitat
    on public.talleres;
create trigger aa_normalizar_provincia_comunitat
before insert or update of provincia, codigo_postal on public.talleres
for each row execute function public.normalizar_provincia_comunitat_valenciana();

drop trigger if exists aa_normalizar_provincia_comunitat
    on public.solicitudes_alta_taller;
create trigger aa_normalizar_provincia_comunitat
before insert or update of provincia, codigo_postal on public.solicitudes_alta_taller
for each row execute function public.normalizar_provincia_comunitat_valenciana();

with normalizados as (
    select
        id,
        public.provincia_canonica_comunitat_valenciana(
            codigo_postal,
            provincia
        ) as provincia
    from public.talleres
)
update public.talleres t
set provincia = n.provincia,
    updated_at = now()
from normalizados n
where t.id = n.id
  and n.provincia is not null
  and t.provincia is distinct from n.provincia;

with normalizadas as (
    select
        id,
        public.provincia_canonica_comunitat_valenciana(
            codigo_postal,
            provincia
        ) as provincia
    from public.solicitudes_alta_taller
)
update public.solicitudes_alta_taller s
set provincia = n.provincia
from normalizadas n
where s.id = n.id
  and n.provincia is not null
  and s.provincia is distinct from n.provincia;

revoke all on function public.provincia_canonica_comunitat_valenciana(text, text)
    from public, anon, authenticated;
revoke all on function public.normalizar_provincia_comunitat_valenciana()
    from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;

-- Comprobaciones opcionales:
-- select provincia, count(*) from public.talleres
-- where left(btrim(coalesce(codigo_postal, '')), 2) in ('03', '12', '46')
-- group by provincia order by provincia;
-- select count(*) as codigos_valencianos_con_provincia_incorrecta
-- from public.talleres
-- where public.provincia_canonica_comunitat_valenciana(codigo_postal, provincia)
--       is distinct from provincia;

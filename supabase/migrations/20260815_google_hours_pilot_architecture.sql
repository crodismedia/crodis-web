alter table public.talleres
  add column if not exists google_place_id text,
  add column if not exists google_horario_regular jsonb,
  add column if not exists google_horario_actual jsonb,
  add column if not exists google_horario_consultado_at timestamptz,
  add column if not exists google_horario_estado text,
  add column if not exists google_horario_piloto boolean not null default false;

comment on column public.talleres.google_place_id is 'Google Places place ID confirmado para consultas de horario.';
comment on column public.talleres.google_horario_regular is 'Último horario regular recibido de Google Places, normalizado al formato TallerMap.';
comment on column public.talleres.google_horario_actual is 'Último horario actual/especial recibido de Google Places (puede incluir excepciones o festivos).';
comment on column public.talleres.google_horario_consultado_at is 'Fecha de la última consulta de horario a Google Places.';
comment on column public.talleres.google_horario_estado is 'Resultado de la última comparación: coincide, actualizado, sin_horario, error.';
comment on column public.talleres.google_horario_piloto is 'Activa el piloto de consulta/actualización de horario Google para una ficha.';

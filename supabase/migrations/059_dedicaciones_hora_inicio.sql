-- ============================================================
-- 059_dedicaciones_hora_inicio.sql
-- Añade hora_inicio a dedicaciones para soportar la vista de
-- calendario (rejilla horaria día/semana). Las dedicaciones
-- antiguas se quedan con NULL y se renderizan a las 09:00 por
-- defecto en la UI; al editarlas se obliga a configurar la hora.
-- ============================================================

ALTER TABLE dedicaciones
  ADD COLUMN hora_inicio TIME;

COMMENT ON COLUMN dedicaciones.hora_inicio IS
  'Hora de inicio del bloque de horas en la fecha. NULL en filas históricas previas a la vista calendario.';

-- ============================================================
-- 060_dedicaciones_estado_revisar.sql
-- Añade el estado 'Revisar' al workflow de dedicaciones.
-- 'Revisar' lo aplica gestión cuando rechaza una dedicación
-- en Enviado para que el autor la corrija. El autor puede
-- editarla en este estado y volverla a poner en Enviado.
-- ============================================================

ALTER TABLE dedicaciones DROP CONSTRAINT dedicaciones_estado_check;

ALTER TABLE dedicaciones
  ADD CONSTRAINT dedicaciones_estado_check
  CHECK (estado IN ('Borrador', 'Enviado', 'Aprobado', 'Revisar'));

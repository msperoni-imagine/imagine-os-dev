-- ============================================================
-- 051_dedicaciones.sql
-- Registro de horas reales trabajadas por cada persona.
-- Pieza central del PSA: complementa a `asignaciones` (planificación)
-- y permite calcular ejecución real, márgenes y plan vs real.
-- ============================================================

CREATE TABLE dedicaciones (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id       UUID NOT NULL REFERENCES personas(id),
  orden_trabajo_id UUID REFERENCES ordenes_trabajo(id),  -- nullable: horas internas sin OT
  proyecto_id      UUID REFERENCES proyectos(id),         -- redundante pero útil para queries agregadas
  fecha            DATE NOT NULL,
  horas            NUMERIC NOT NULL CHECK (horas > 0 AND horas <= 24),
  descripcion      TEXT,
  tipo             TEXT NOT NULL CHECK (tipo IN ('Facturable', 'No facturable', 'Interno', 'Formación')),
  estado           TEXT NOT NULL DEFAULT 'Borrador' CHECK (estado IN ('Borrador', 'Enviado', 'Aprobado')),
  aprobado_por_id  UUID REFERENCES personas(id),
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_dedicaciones_persona_fecha ON dedicaciones (persona_id, fecha);
CREATE INDEX idx_dedicaciones_ot           ON dedicaciones (orden_trabajo_id) WHERE orden_trabajo_id IS NOT NULL;
CREATE INDEX idx_dedicaciones_proyecto     ON dedicaciones (proyecto_id)      WHERE proyecto_id IS NOT NULL;
CREATE INDEX idx_dedicaciones_estado       ON dedicaciones (estado);
CREATE INDEX idx_dedicaciones_deleted      ON dedicaciones (deleted_at)       WHERE deleted_at IS NULL;

-- Trigger updated_at (reutiliza la función global update_updated_at definida en 001)
CREATE TRIGGER trg_dedicaciones_updated_at
  BEFORE UPDATE ON dedicaciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: habilitado sin políticas. Las policies definitivas se añaden en
-- la migración del Bloque 9 (permisos por rol para los 3 módulos nuevos).
ALTER TABLE dedicaciones ENABLE ROW LEVEL SECURITY;

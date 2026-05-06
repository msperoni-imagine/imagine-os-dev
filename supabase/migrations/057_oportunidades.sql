-- ============================================================
-- 057_oportunidades.sql
-- Pipeline de ventas: cada empresa puede tener varias oportunidades
-- comerciales simultáneas. Al cerrar una oportunidad como ganada se
-- puede vincular a un proyecto existente o crear uno nuevo.
-- ============================================================

BEGIN;

CREATE TABLE oportunidades (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id              UUID NOT NULL REFERENCES empresas(id),
  empresa_grupo_id        UUID NOT NULL REFERENCES empresas_grupo(id),
  titulo                  TEXT NOT NULL,
  descripcion             TEXT,
  valor_estimado          NUMERIC,
  probabilidad_pct        INTEGER CHECK (probabilidad_pct IS NULL OR (probabilidad_pct >= 0 AND probabilidad_pct <= 100)),
  etapa                   TEXT NOT NULL DEFAULT 'Prospección' CHECK (etapa IN (
    'Prospección', 'Propuesta enviada', 'Negociación', 'Verbal',
    'Cerrada ganada', 'Cerrada perdida'
  )),
  fecha_cierre_estimada   DATE,
  fecha_cierre_real       DATE,
  motivo_perdida          TEXT,
  contacto_id             UUID REFERENCES contactos_empresas(id),
  responsable_id          UUID NOT NULL REFERENCES personas(id),
  proyecto_id             UUID REFERENCES proyectos(id),
  notas                   TEXT,
  deleted_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_oportunidades_empresa      ON oportunidades (empresa_id);
CREATE INDEX idx_oportunidades_eg           ON oportunidades (empresa_grupo_id);
CREATE INDEX idx_oportunidades_etapa        ON oportunidades (etapa);
CREATE INDEX idx_oportunidades_responsable  ON oportunidades (responsable_id);
CREATE INDEX idx_oportunidades_proyecto     ON oportunidades (proyecto_id) WHERE proyecto_id IS NOT NULL;
CREATE INDEX idx_oportunidades_deleted      ON oportunidades (deleted_at)  WHERE deleted_at IS NULL;
CREATE INDEX idx_oportunidades_fecha_cierre ON oportunidades (fecha_cierre_estimada);

-- Trigger updated_at
CREATE TRIGGER trg_oportunidades_updated_at
  BEFORE UPDATE ON oportunidades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: información comercial sensible. Solo niveles global y empresa (su EG).
ALTER TABLE oportunidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sel_oportunidades" ON oportunidades
  FOR SELECT TO authenticated USING (
    get_mi_nivel_acceso() = 'global'
    OR (get_mi_nivel_acceso() = 'empresa' AND empresa_grupo_id = get_mi_empresa_grupo_id())
  );

CREATE POLICY "ins_oportunidades" ON oportunidades
  FOR INSERT TO authenticated WITH CHECK (
    get_mi_nivel_acceso() = 'global'
    OR (get_mi_nivel_acceso() = 'empresa' AND empresa_grupo_id = get_mi_empresa_grupo_id())
  );

CREATE POLICY "upd_oportunidades" ON oportunidades
  FOR UPDATE TO authenticated USING (
    get_mi_nivel_acceso() = 'global'
    OR (get_mi_nivel_acceso() = 'empresa' AND empresa_grupo_id = get_mi_empresa_grupo_id())
  );

CREATE POLICY "del_oportunidades" ON oportunidades
  FOR DELETE TO authenticated USING (
    get_mi_nivel_acceso() = 'global'
  );

COMMIT;

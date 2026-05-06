-- ============================================================
-- 056_costes_fijos.sql
-- Tabla para registrar costes fijos / overhead operativo:
--   - Coste mensual con `importe`.
--   - Si recurrente, `mes_inicio` + `mes_fin` (null = sin fin) definen vigencia.
--   - Asignable a una empresa cliente (empresa_id) y a varios departamentos
--     y/o personas (vía tablas N:M).
--
-- IMPORTANTE: este módulo NO se integra en los cálculos de margen del
-- Bloque 5 — es de visibilidad e informe propio. Cuando se decida cómo
-- repartir overhead a OT/proyecto/persona, se evolucionará el modelo
-- (opciones B/C en la propuesta).
-- ============================================================

BEGIN;

CREATE TABLE costes_fijos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_grupo_id  UUID NOT NULL REFERENCES empresas_grupo(id),
  concepto          TEXT NOT NULL,
  categoria         TEXT NOT NULL CHECK (categoria IN (
    'Inmueble', 'Suministros', 'Comida', 'Software', 'Equipamiento',
    'Viajes', 'Formación', 'Salario', 'Externo', 'Otros'
  )),
  mes_inicio        DATE NOT NULL,
  mes_fin           DATE,
  importe           NUMERIC NOT NULL CHECK (importe >= 0),
  recurrente        BOOLEAN NOT NULL DEFAULT false,
  empresa_id        UUID REFERENCES empresas(id),
  notas             TEXT,
  deleted_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Coherencia: mes_fin sólo tiene sentido si es recurrente; y debe ser >= mes_inicio
  CONSTRAINT chk_mes_fin_solo_si_recurrente CHECK (mes_fin IS NULL OR recurrente = true),
  CONSTRAINT chk_mes_fin_orden CHECK (mes_fin IS NULL OR mes_fin >= mes_inicio)
);

-- Índices para consultas típicas
CREATE INDEX idx_costes_fijos_eg          ON costes_fijos (empresa_grupo_id);
CREATE INDEX idx_costes_fijos_categoria   ON costes_fijos (categoria);
CREATE INDEX idx_costes_fijos_mes_inicio  ON costes_fijos (mes_inicio);
CREATE INDEX idx_costes_fijos_recurrente  ON costes_fijos (recurrente)             WHERE deleted_at IS NULL;
CREATE INDEX idx_costes_fijos_empresa     ON costes_fijos (empresa_id)             WHERE empresa_id IS NOT NULL;
CREATE INDEX idx_costes_fijos_deleted     ON costes_fijos (deleted_at)             WHERE deleted_at IS NULL;

-- Trigger updated_at (reutiliza la función global)
CREATE TRIGGER trg_costes_fijos_updated_at
  BEFORE UPDATE ON costes_fijos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Tabla N:M con departamentos
CREATE TABLE costes_fijos_departamentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coste_fijo_id   UUID NOT NULL REFERENCES costes_fijos(id) ON DELETE CASCADE,
  departamento_id UUID NOT NULL REFERENCES departamentos(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_coste_fijo_depto UNIQUE (coste_fijo_id, departamento_id)
);
CREATE INDEX idx_cfd_coste ON costes_fijos_departamentos (coste_fijo_id);
CREATE INDEX idx_cfd_depto ON costes_fijos_departamentos (departamento_id);

-- Tabla N:M con personas
CREATE TABLE costes_fijos_personas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coste_fijo_id UUID NOT NULL REFERENCES costes_fijos(id) ON DELETE CASCADE,
  persona_id    UUID NOT NULL REFERENCES personas(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_coste_fijo_persona UNIQUE (coste_fijo_id, persona_id)
);
CREATE INDEX idx_cfp_coste   ON costes_fijos_personas (coste_fijo_id);
CREATE INDEX idx_cfp_persona ON costes_fijos_personas (persona_id);

-- ── RLS ──
-- Al ser información financiera sensible (incluye salarios externos, gastos),
-- el módulo se restringe a niveles de gestión: global y empresa (en su EG).
-- Nivel 'personal' NO ve nada.

ALTER TABLE costes_fijos                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE costes_fijos_departamentos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE costes_fijos_personas         ENABLE ROW LEVEL SECURITY;

-- costes_fijos
CREATE POLICY "sel_costes_fijos" ON costes_fijos
  FOR SELECT TO authenticated USING (
    get_mi_nivel_acceso() = 'global'
    OR (get_mi_nivel_acceso() = 'empresa' AND empresa_grupo_id = get_mi_empresa_grupo_id())
  );

CREATE POLICY "ins_costes_fijos" ON costes_fijos
  FOR INSERT TO authenticated WITH CHECK (
    get_mi_nivel_acceso() = 'global'
    OR (get_mi_nivel_acceso() = 'empresa' AND empresa_grupo_id = get_mi_empresa_grupo_id())
  );

CREATE POLICY "upd_costes_fijos" ON costes_fijos
  FOR UPDATE TO authenticated USING (
    get_mi_nivel_acceso() = 'global'
    OR (get_mi_nivel_acceso() = 'empresa' AND empresa_grupo_id = get_mi_empresa_grupo_id())
  );

CREATE POLICY "del_costes_fijos" ON costes_fijos
  FOR DELETE TO authenticated USING (
    get_mi_nivel_acceso() = 'global'
  );

-- N:M departamentos: hereda de costes_fijos (si puedes ver el coste, puedes ver sus relaciones)
CREATE POLICY "sel_cfd" ON costes_fijos_departamentos
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM costes_fijos cf WHERE cf.id = coste_fijo_id)
  );
CREATE POLICY "ins_cfd" ON costes_fijos_departamentos
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM costes_fijos cf WHERE cf.id = coste_fijo_id)
  );
CREATE POLICY "upd_cfd" ON costes_fijos_departamentos
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM costes_fijos cf WHERE cf.id = coste_fijo_id)
  );
CREATE POLICY "del_cfd" ON costes_fijos_departamentos
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM costes_fijos cf WHERE cf.id = coste_fijo_id)
  );

-- N:M personas
CREATE POLICY "sel_cfp" ON costes_fijos_personas
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM costes_fijos cf WHERE cf.id = coste_fijo_id)
  );
CREATE POLICY "ins_cfp" ON costes_fijos_personas
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM costes_fijos cf WHERE cf.id = coste_fijo_id)
  );
CREATE POLICY "upd_cfp" ON costes_fijos_personas
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM costes_fijos cf WHERE cf.id = coste_fijo_id)
  );
CREATE POLICY "del_cfp" ON costes_fijos_personas
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM costes_fijos cf WHERE cf.id = coste_fijo_id)
  );

COMMIT;

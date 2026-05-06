-- ============================================================
-- 053_dedicaciones_rls_policies.sql
-- Políticas RLS para `dedicaciones`.
--
-- NOTA: el plan de implementación original (instrucciones-implementacion-company-os.md,
-- Bloque 9) reservaba las policies para el final, pero sin ellas la tabla es
-- ilegible (RLS activado sin policies = bloquea todo). Se adelantan aquí y se
-- darán por resueltas al llegar al Bloque 9.
--
-- Niveles (fuente: docs/modelo-datos-v4.md + 035_rls_real.sql):
--   global   → lee y escribe todo (Fundador, Socio, Administrador)
--   empresa  → lee y escribe solo personas de su empresa_grupo (Director, Coordinador, Responsable)
--   personal → lee y escribe solo sus propias dedicaciones (Miembro, Intern, Externo, Implant)
--
-- El workflow de estados (quién puede aprobar, devolver, etc.) NO se valida
-- en RLS, vive en el server action. RLS solo es la defensa de primera capa.
-- ============================================================

BEGIN;

-- Limpiar por si se reintroduce
DROP POLICY IF EXISTS "sel_dedicaciones" ON dedicaciones;
DROP POLICY IF EXISTS "ins_dedicaciones" ON dedicaciones;
DROP POLICY IF EXISTS "upd_dedicaciones" ON dedicaciones;
DROP POLICY IF EXISTS "del_dedicaciones" ON dedicaciones;

-- SELECT: global todo; empresa las de su EG; personal solo las suyas
CREATE POLICY "sel_dedicaciones" ON dedicaciones
  FOR SELECT TO authenticated USING (
    get_mi_nivel_acceso() = 'global'
    OR persona_id = get_mi_persona_id()
    OR (
      get_mi_nivel_acceso() = 'empresa'
      AND EXISTS (
        SELECT 1 FROM personas p
        WHERE p.id = dedicaciones.persona_id
          AND p.empresa_grupo_id = get_mi_empresa_grupo_id()
      )
    )
  );

-- INSERT: cualquier autenticado puede crear SUS propias; gestión puede crear para su ámbito
CREATE POLICY "ins_dedicaciones" ON dedicaciones
  FOR INSERT TO authenticated WITH CHECK (
    persona_id = get_mi_persona_id()
    OR get_mi_nivel_acceso() = 'global'
    OR (
      get_mi_nivel_acceso() = 'empresa'
      AND EXISTS (
        SELECT 1 FROM personas p
        WHERE p.id = dedicaciones.persona_id
          AND p.empresa_grupo_id = get_mi_empresa_grupo_id()
      )
    )
  );

-- UPDATE: mismo ámbito. Cubre edición, cambio de estado y soft delete (set deleted_at)
CREATE POLICY "upd_dedicaciones" ON dedicaciones
  FOR UPDATE TO authenticated USING (
    persona_id = get_mi_persona_id()
    OR get_mi_nivel_acceso() = 'global'
    OR (
      get_mi_nivel_acceso() = 'empresa'
      AND EXISTS (
        SELECT 1 FROM personas p
        WHERE p.id = dedicaciones.persona_id
          AND p.empresa_grupo_id = get_mi_empresa_grupo_id()
      )
    )
  );

-- DELETE físico: reservado a admins (global). La app usa soft-delete vía UPDATE.
CREATE POLICY "del_dedicaciones" ON dedicaciones
  FOR DELETE TO authenticated USING (
    get_mi_nivel_acceso() = 'global'
  );

COMMIT;

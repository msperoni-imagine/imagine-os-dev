-- ============================================================
-- 055_condiciones_seed.sql
-- Seed sintético de `condiciones` para las 8 personas de DME que
-- tienen dedicaciones en el seed del Bloque 1. Sirve para testear
-- la vista Plan vs Real y el módulo de márgenes hasta que se carguen
-- las condiciones reales desde Google Sheets u otro canal.
--
-- Los salarios son estimaciones de mercado para agencias digitales
-- en España (2025). Sobrescribir con datos reales cuando existan.
-- El trigger `calcular_coste_hora` (054) rellena coste_hora_calculado.
--
-- Tabla de salarios (brutos anuales) por rango:
--   Intern       (INT)   → 18.000 €
--   Externo      (EXT)   → 30.000 €
--   Implant      (IMP)   → 35.000 €
--   Junior       (JR)    → 24.000 €
--   Specialist   (SPEC)  → 35.000 €
--   Senior       (SR)    → 42.000 €
--   Team Head    (THEAD) → 55.000 €
--   Studio Head  (SHEAD) → 65.000 €
--   Director     (DIR)   → 80.000 €
--   Socio        (SOCIO) → 100.000 €
-- Coste SS = ~30% del salario bruto (estimación España).
-- ============================================================

BEGIN;

INSERT INTO condiciones (
  persona_id, fecha_inicio, empresa_grupo_id,
  departamento_id, rango_id, puesto_id, division_id, rol_id,
  salario_bruto_anual, tipo_contrato, jornada, horas_semana,
  coste_seguridad_social, dias_vacaciones, modalidad_trabajo, notas
)
SELECT
  p.id,
  '2024-01-01'::date,
  p.empresa_grupo_id,
  (SELECT pd.departamento_id FROM personas_departamentos pd WHERE pd.persona_id = p.id LIMIT 1),
  p.rango_id,
  p.puesto_id,
  p.division_id,
  p.rol_id,
  CASE ri.codigo
    WHEN 'INT'   THEN 18000
    WHEN 'EXT'   THEN 30000
    WHEN 'IMP'   THEN 35000
    WHEN 'JR'    THEN 24000
    WHEN 'SPEC'  THEN 35000
    WHEN 'SR'    THEN 42000
    WHEN 'THEAD' THEN 55000
    WHEN 'SHEAD' THEN 65000
    WHEN 'DIR'   THEN 80000
    WHEN 'SOCIO' THEN 100000
    ELSE 30000
  END                                  AS salario_bruto_anual,
  'Indefinido'                         AS tipo_contrato,
  'Completa'                           AS jornada,
  40                                   AS horas_semana,
  CASE ri.codigo                                  -- Coste SS ≈ 30%
    WHEN 'INT'   THEN 5400
    WHEN 'EXT'   THEN 9000
    WHEN 'IMP'   THEN 10500
    WHEN 'JR'    THEN 7200
    WHEN 'SPEC'  THEN 10500
    WHEN 'SR'    THEN 12600
    WHEN 'THEAD' THEN 16500
    WHEN 'SHEAD' THEN 19500
    WHEN 'DIR'   THEN 24000
    WHEN 'SOCIO' THEN 30000
    ELSE 9000
  END                                  AS coste_seguridad_social,
  23                                   AS dias_vacaciones,
  'Híbrido'                            AS modalidad_trabajo,
  'Condición inicial (seed sintético — sobrescribir con datos reales)' AS notas
FROM personas p
JOIN rangos_internos ri ON ri.id = p.rango_id
WHERE p.id IN (
  '90000000-0000-0000-0000-000000000047',   -- Ainhoa B
  'c00ac986-6fd3-4188-bc6f-70ebc63b3fbb',   -- Ainoha Castelló
  '90000000-0000-0000-0000-000000000013',   -- Alba C
  '90000000-0000-0000-0000-000000000050',   -- Alba M
  '90000000-0000-0000-0000-000000000008',   -- Alejandro R
  '90000000-0000-0000-0000-000000000048',   -- Alejo P
  '90000000-0000-0000-0000-000000000042',   -- Alexandra D
  '90000000-0000-0000-0000-000000000054'    -- Amparo M
)
AND p.puesto_id IS NOT NULL
AND EXISTS (SELECT 1 FROM personas_departamentos pd WHERE pd.persona_id = p.id);

COMMIT;

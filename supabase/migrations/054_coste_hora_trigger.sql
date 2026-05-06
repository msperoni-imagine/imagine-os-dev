-- ============================================================
-- 054_coste_hora_trigger.sql
-- Trigger que calcula `condiciones.coste_hora_calculado` automáticamente
-- a partir de salario bruto anual, coste de seguridad social y horas/semana.
--
-- Fórmula: (salario_bruto_anual + coste_seguridad_social) / (horas_semana × 52)
--
-- Además crea la función `coste_hora_persona(persona_id, fecha)` que resuelve
-- el coste/hora de una persona en una fecha dada consultando la condición
-- vigente en ese periodo.
-- ============================================================

BEGIN;

-- Función que calcula el coste/hora en BEFORE INSERT/UPDATE
CREATE OR REPLACE FUNCTION calcular_coste_hora()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.salario_bruto_anual IS NOT NULL
     AND NEW.horas_semana IS NOT NULL
     AND NEW.horas_semana > 0 THEN
    NEW.coste_hora_calculado := (
      COALESCE(NEW.salario_bruto_anual, 0) + COALESCE(NEW.coste_seguridad_social, 0)
    ) / (NEW.horas_semana * 52);
  ELSE
    NEW.coste_hora_calculado := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger en condiciones
DROP TRIGGER IF EXISTS trg_calcular_coste_hora ON condiciones;
CREATE TRIGGER trg_calcular_coste_hora
  BEFORE INSERT OR UPDATE ON condiciones
  FOR EACH ROW
  EXECUTE FUNCTION calcular_coste_hora();

-- Recalcular los registros existentes disparando el trigger vía UPDATE
UPDATE condiciones SET updated_at = now();

-- Función para resolver el coste/hora de una persona en una fecha concreta.
-- Útil en queries de margen: se hace JOIN lateral o se llama desde TS.
-- STABLE: permite que Postgres la use eficientemente en expresiones.
CREATE OR REPLACE FUNCTION coste_hora_persona(p_persona_id UUID, p_fecha DATE)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT coste_hora_calculado
  FROM condiciones
  WHERE persona_id = p_persona_id
    AND fecha_inicio <= p_fecha
    AND (fecha_fin IS NULL OR fecha_fin >= p_fecha)
    AND deleted_at IS NULL
  ORDER BY fecha_inicio DESC
  LIMIT 1;
$$;

COMMIT;

// ============================================================
// Cálculos de márgenes y plan-vs-real en cliente (memoria).
// Replican la función SQL `coste_hora_persona` y la lógica de
// horas planificadas que ya usa el resto de la app.
//
// Todas las funciones son puras y seguras con datos incompletos:
// devuelven `null` o marcan `incompleto: true` en lugar de lanzar.
// ============================================================

import type {
  Dedicacion,
  Condicion,
  OrdenTrabajo,
  Asignacion,
  CuotaPlanificacion,
} from '@/lib/supabase/types'

/**
 * Resuelve el coste/hora vigente de una persona en una fecha dada.
 * Replica la función SQL `coste_hora_persona`. Devuelve null si no hay
 * condición vigente o si la condición no tiene `coste_hora_calculado`.
 */
export function resolverCosteHora(
  personaId: string,
  fecha: string,
  condiciones: Condicion[],
): number | null {
  let mejor: Condicion | null = null
  for (const c of condiciones) {
    if (c.persona_id !== personaId) continue
    if (c.deleted_at) continue
    if (c.fecha_inicio > fecha) continue
    if (c.fecha_fin !== null && c.fecha_fin < fecha) continue
    if (!mejor || c.fecha_inicio > mejor.fecha_inicio) mejor = c
  }
  return mejor?.coste_hora_calculado ?? null
}

/**
 * Suma el coste real de un conjunto de dedicaciones:
 *   sum(horas × coste_hora_persona(fecha))
 * Si alguna dedicación no tiene coste resoluble, se ignora en la suma
 * y se marca `incompleto: true` para que la UI pueda avisar.
 */
export function calcularCosteReal(
  dedicaciones: Dedicacion[],
  condiciones: Condicion[],
): { costeTotal: number; incompleto: boolean } {
  let costeTotal = 0
  let incompleto = false
  for (const d of dedicaciones) {
    if (d.deleted_at) continue
    const coste = resolverCosteHora(d.persona_id, d.fecha, condiciones)
    if (coste === null) {
      incompleto = true
    } else {
      costeTotal += Number(d.horas) * Number(coste)
    }
  }
  return { costeTotal, incompleto }
}

/**
 * Horas planificadas de una OT desde sus asignaciones y las cuotas.
 * Fórmula ya usada en toda la app: partida_prevista × pct/100 / precio_hora.
 */
export function horasPlanOt(
  ot: OrdenTrabajo,
  asignacionesOt: Asignacion[],
  cuotasById: Map<string, CuotaPlanificacion>,
): number {
  return asignacionesOt.reduce((sum, a) => {
    if (a.deleted_at) return sum
    const cuota = cuotasById.get(a.cuota_planificacion_id)
    if (!cuota || cuota.precio_hora <= 0) return sum
    const ingresos = ot.partida_prevista * (a.porcentaje_ppto_tm / 100)
    return sum + ingresos / cuota.precio_hora
  }, 0)
}

/**
 * Horas reales de una OT = suma de horas de sus dedicaciones (no eliminadas).
 */
export function horasRealOt(otId: string, dedicaciones: Dedicacion[]): number {
  let total = 0
  for (const d of dedicaciones) {
    if (d.orden_trabajo_id !== otId) continue
    if (d.deleted_at) continue
    total += Number(d.horas)
  }
  return total
}

export type MargenResultado = {
  ingresosReales: number | null
  costeReal: number
  margenEur: number | null
  margenPct: number | null
  incompleto: boolean
}

/**
 * Margen real de una OT:
 *   ingresosReales = ot.partida_real
 *   costeReal      = coste real de las dedicaciones de la OT
 *   margenEur      = ingresos - coste
 *   margenPct      = margen / ingresos × 100
 *
 * Si la OT no tiene partida_real, ingresosReales/margenEur/margenPct son null.
 * Si ninguna dedicación puede resolver coste, `incompleto` vale true y la UI
 * debe mostrar "Sin datos" en lugar de un margen incorrecto.
 */
export function calcularMargenOt(
  ot: OrdenTrabajo,
  dedicaciones: Dedicacion[],
  condiciones: Condicion[],
): MargenResultado {
  const dedicsOt = dedicaciones.filter((d) => d.orden_trabajo_id === ot.id && !d.deleted_at)
  const { costeTotal, incompleto } = calcularCosteReal(dedicsOt, condiciones)

  const ingresosReales = ot.partida_real
  if (ingresosReales === null || ingresosReales === undefined) {
    return { ingresosReales: null, costeReal: costeTotal, margenEur: null, margenPct: null, incompleto }
  }

  const margenEur = ingresosReales - costeTotal
  const margenPct = ingresosReales > 0 ? (margenEur / ingresosReales) * 100 : null
  return { ingresosReales, costeReal: costeTotal, margenEur, margenPct, incompleto }
}

/**
 * Desviación porcentual entre horas reales y planificadas.
 *   Δ% = (real - plan) / plan × 100
 * Devuelve null si plan es 0 (división por cero sin sentido).
 */
export function desviacionPct(horasReal: number, horasPlan: number): number | null {
  if (horasPlan <= 0) return null
  return ((horasReal - horasPlan) / horasPlan) * 100
}

/**
 * Tono semafórico para una desviación porcentual.
 *   |Δ| ≤ 10%  → verde
 *   |Δ| ≤ 25%  → ámbar
 *   |Δ| > 25%  → rojo
 */
export function tonoDesviacion(pct: number | null): 'verde' | 'ambar' | 'rojo' | 'neutro' {
  if (pct === null) return 'neutro'
  const abs = Math.abs(pct)
  if (abs <= 10) return 'verde'
  if (abs <= 25) return 'ambar'
  return 'rojo'
}

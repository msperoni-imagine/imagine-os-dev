'use server'

import { createClient } from '@/lib/supabase/server'
import { getUsuarioConNivel, NIVELES_GESTION } from '@/lib/supabase/auth-helpers'
import { costeFijoSchema } from '@/lib/schemas/coste-fijo'
import { revalidatePath } from 'next/cache'
import { registrarAuditoria } from '@/lib/supabase/audit'
import type { ActionResult } from '@/lib/types/action-result'

const ERROR_SIN_PERMISO = 'No tienes permiso para esta acción'

/**
 * Sincroniza las relaciones N:M de un coste fijo con sus departamentos y personas:
 * borra las existentes y crea las nuevas. Patrón "drop & insert" — simple y suficiente
 * para volúmenes pequeños (un coste tendrá pocas asignaciones).
 */
async function sincronizarRelaciones(
  costeFijoId: string,
  departamentoIds: string[],
  personaIds: string[],
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient()

  // Departamentos
  const { error: errDelD } = await supabase
    .from('costes_fijos_departamentos')
    .delete()
    .eq('coste_fijo_id', costeFijoId)
  if (errDelD) return { success: false, error: `Error al limpiar departamentos: ${errDelD.message}` }

  if (departamentoIds.length > 0) {
    const { error: errInsD } = await supabase
      .from('costes_fijos_departamentos')
      .insert(departamentoIds.map((d) => ({ coste_fijo_id: costeFijoId, departamento_id: d })))
    if (errInsD) return { success: false, error: `Error al asignar departamentos: ${errInsD.message}` }
  }

  // Personas
  const { error: errDelP } = await supabase
    .from('costes_fijos_personas')
    .delete()
    .eq('coste_fijo_id', costeFijoId)
  if (errDelP) return { success: false, error: `Error al limpiar personas: ${errDelP.message}` }

  if (personaIds.length > 0) {
    const { error: errInsP } = await supabase
      .from('costes_fijos_personas')
      .insert(personaIds.map((p) => ({ coste_fijo_id: costeFijoId, persona_id: p })))
    if (errInsP) return { success: false, error: `Error al asignar personas: ${errInsP.message}` }
  }

  return { success: true }
}

export async function crearCosteFijo(formData: unknown): Promise<ActionResult> {
  const autorizado = await getUsuarioConNivel(NIVELES_GESTION)
  if (!autorizado) return { success: false, error: ERROR_SIN_PERMISO }

  const parsed = costeFijoSchema.safeParse(formData)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const data = parsed.data
  const supabase = await createClient()

  const { data: nuevo, error } = await supabase
    .from('costes_fijos')
    .insert({
      empresa_grupo_id: data.empresa_grupo_id,
      concepto: data.concepto,
      categoria: data.categoria,
      mes_inicio: data.mes_inicio,
      mes_fin: data.recurrente && data.mes_fin ? data.mes_fin : null,
      importe: data.importe,
      recurrente: data.recurrente,
      empresa_id: data.empresa_id || null,
      notas: data.notas || null,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: `Error al crear el coste fijo: ${error.message}` }

  const sync = await sincronizarRelaciones(nuevo.id, data.departamento_ids, data.persona_ids)
  if (!sync.success) return sync

  revalidatePath('/costes-fijos')
  void registrarAuditoria({ persona: autorizado, accion: 'crear', tabla: 'costes_fijos', registroId: nuevo.id })
  return { success: true, id: nuevo.id }
}

export async function actualizarCosteFijo(id: string, formData: unknown): Promise<ActionResult> {
  const autorizado = await getUsuarioConNivel(NIVELES_GESTION)
  if (!autorizado) return { success: false, error: ERROR_SIN_PERMISO }

  const parsed = costeFijoSchema.safeParse(formData)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const data = parsed.data
  const supabase = await createClient()

  const { error } = await supabase
    .from('costes_fijos')
    .update({
      empresa_grupo_id: data.empresa_grupo_id,
      concepto: data.concepto,
      categoria: data.categoria,
      mes_inicio: data.mes_inicio,
      mes_fin: data.recurrente && data.mes_fin ? data.mes_fin : null,
      importe: data.importe,
      recurrente: data.recurrente,
      empresa_id: data.empresa_id || null,
      notas: data.notas || null,
    })
    .eq('id', id)

  if (error) return { success: false, error: `Error al actualizar el coste fijo: ${error.message}` }

  const sync = await sincronizarRelaciones(id, data.departamento_ids, data.persona_ids)
  if (!sync.success) return sync

  revalidatePath('/costes-fijos')
  void registrarAuditoria({ persona: autorizado, accion: 'actualizar', tabla: 'costes_fijos', registroId: id })
  return { success: true }
}

export async function eliminarCosteFijo(id: string): Promise<ActionResult> {
  const autorizado = await getUsuarioConNivel(NIVELES_GESTION)
  if (!autorizado) return { success: false, error: ERROR_SIN_PERMISO }

  const supabase = await createClient()
  const { error } = await supabase
    .from('costes_fijos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)

  if (error) return { success: false, error: `Error al eliminar el coste fijo: ${error.message}` }

  revalidatePath('/costes-fijos')
  void registrarAuditoria({ persona: autorizado, accion: 'eliminar', tabla: 'costes_fijos', registroId: id })
  return { success: true }
}

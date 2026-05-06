'use server'

import { createClient } from '@/lib/supabase/server'
import { getUsuarioConNivel, NIVELES_GESTION } from '@/lib/supabase/auth-helpers'
import { oportunidadSchema, ETAPAS_OPORTUNIDAD, type EtapaOportunidad } from '@/lib/schemas/oportunidad'
import { revalidatePath } from 'next/cache'
import { registrarAuditoria } from '@/lib/supabase/audit'
import type { ActionResult } from '@/lib/types/action-result'

const ERROR_SIN_PERMISO = 'No tienes permiso para esta acción'

function nullify(s: string): string | null {
  return s.trim().length > 0 ? s : null
}

export async function crearOportunidad(formData: unknown): Promise<ActionResult> {
  const autorizado = await getUsuarioConNivel(NIVELES_GESTION)
  if (!autorizado) return { success: false, error: ERROR_SIN_PERMISO }

  const parsed = oportunidadSchema.safeParse(formData)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const data = parsed.data
  const supabase = await createClient()

  const { data: nueva, error } = await supabase
    .from('oportunidades')
    .insert({
      empresa_id: data.empresa_id,
      empresa_grupo_id: data.empresa_grupo_id,
      titulo: data.titulo,
      descripcion: nullify(data.descripcion),
      valor_estimado: data.valor_estimado,
      probabilidad_pct: data.probabilidad_pct,
      etapa: data.etapa,
      fecha_cierre_estimada: nullify(data.fecha_cierre_estimada),
      fecha_cierre_real: nullify(data.fecha_cierre_real),
      motivo_perdida: nullify(data.motivo_perdida),
      contacto_id: nullify(data.contacto_id),
      responsable_id: data.responsable_id,
      proyecto_id: nullify(data.proyecto_id),
      notas: nullify(data.notas),
    })
    .select('id')
    .single()

  if (error) return { success: false, error: `Error al crear la oportunidad: ${error.message}` }

  revalidatePath('/oportunidades')
  revalidatePath('/empresas')
  void registrarAuditoria({ persona: autorizado, accion: 'crear', tabla: 'oportunidades', registroId: nueva.id })
  return { success: true, id: nueva.id }
}

export async function actualizarOportunidad(id: string, formData: unknown): Promise<ActionResult> {
  const autorizado = await getUsuarioConNivel(NIVELES_GESTION)
  if (!autorizado) return { success: false, error: ERROR_SIN_PERMISO }

  const parsed = oportunidadSchema.safeParse(formData)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const data = parsed.data
  const supabase = await createClient()

  const { error } = await supabase
    .from('oportunidades')
    .update({
      empresa_id: data.empresa_id,
      empresa_grupo_id: data.empresa_grupo_id,
      titulo: data.titulo,
      descripcion: nullify(data.descripcion),
      valor_estimado: data.valor_estimado,
      probabilidad_pct: data.probabilidad_pct,
      etapa: data.etapa,
      fecha_cierre_estimada: nullify(data.fecha_cierre_estimada),
      fecha_cierre_real: nullify(data.fecha_cierre_real),
      motivo_perdida: nullify(data.motivo_perdida),
      contacto_id: nullify(data.contacto_id),
      responsable_id: data.responsable_id,
      proyecto_id: nullify(data.proyecto_id),
      notas: nullify(data.notas),
    })
    .eq('id', id)

  if (error) return { success: false, error: `Error al actualizar la oportunidad: ${error.message}` }

  revalidatePath('/oportunidades')
  revalidatePath('/empresas')
  void registrarAuditoria({ persona: autorizado, accion: 'actualizar', tabla: 'oportunidades', registroId: id })
  return { success: true }
}

export async function eliminarOportunidad(id: string): Promise<ActionResult> {
  const autorizado = await getUsuarioConNivel(NIVELES_GESTION)
  if (!autorizado) return { success: false, error: ERROR_SIN_PERMISO }

  const supabase = await createClient()
  const { error } = await supabase
    .from('oportunidades')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)

  if (error) return { success: false, error: `Error al eliminar la oportunidad: ${error.message}` }

  revalidatePath('/oportunidades')
  revalidatePath('/empresas')
  void registrarAuditoria({ persona: autorizado, accion: 'eliminar', tabla: 'oportunidades', registroId: id })
  return { success: true }
}

/**
 * Cambia la etapa de una oportunidad. Si pasa a Cerrada perdida, exige
 * `motivo_perdida`. Si pasa a Cerrada ganada, fija `fecha_cierre_real` a hoy
 * si no estaba puesta. La validación más fina (vincular proyecto, etc.) se
 * hace desde la UI con `actualizarOportunidad` cuando hay más datos que mover.
 */
export async function cambiarEtapaOportunidad(
  id: string,
  nuevaEtapa: string,
  motivoPerdida?: string,
): Promise<ActionResult> {
  const autorizado = await getUsuarioConNivel(NIVELES_GESTION)
  if (!autorizado) return { success: false, error: ERROR_SIN_PERMISO }

  if (!ETAPAS_OPORTUNIDAD.includes(nuevaEtapa as EtapaOportunidad)) {
    return { success: false, error: 'Etapa no válida' }
  }
  const etapa = nuevaEtapa as EtapaOportunidad

  if (etapa === 'Cerrada perdida' && (!motivoPerdida || motivoPerdida.trim().length === 0)) {
    return { success: false, error: 'Indica el motivo de la pérdida' }
  }

  const supabase = await createClient()
  const update: Record<string, unknown> = { etapa }
  if (etapa === 'Cerrada perdida') update.motivo_perdida = motivoPerdida!.trim()
  if (etapa === 'Cerrada ganada') update.fecha_cierre_real = new Date().toISOString().slice(0, 10)
  // Al volver a una etapa abierta, limpiamos los campos de cierre.
  if (etapa !== 'Cerrada ganada' && etapa !== 'Cerrada perdida') {
    update.fecha_cierre_real = null
    update.motivo_perdida = null
  }

  const { error } = await supabase.from('oportunidades').update(update).eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/oportunidades')
  revalidatePath('/empresas')
  void registrarAuditoria({
    persona: autorizado, accion: 'cambiar_estado', tabla: 'oportunidades',
    registroId: id, datosExtra: { etapa, motivoPerdida },
  })
  return { success: true }
}

export async function vincularProyectoAOportunidad(
  oportunidadId: string,
  proyectoId: string,
): Promise<ActionResult> {
  const autorizado = await getUsuarioConNivel(NIVELES_GESTION)
  if (!autorizado) return { success: false, error: ERROR_SIN_PERMISO }
  if (!proyectoId) return { success: false, error: 'Selecciona un proyecto' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('oportunidades')
    .update({ proyecto_id: proyectoId })
    .eq('id', oportunidadId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/oportunidades')
  revalidatePath('/empresas')
  revalidatePath('/proyectos')
  void registrarAuditoria({
    persona: autorizado, accion: 'actualizar', tabla: 'oportunidades',
    registroId: oportunidadId, datosExtra: { proyectoVinculado: proyectoId },
  })
  return { success: true }
}

/**
 * Crea un proyecto nuevo a partir de una oportunidad cerrada ganada y lo
 * vincula automáticamente. Se prerellena cliente, EG, título y ppto a partir
 * de la oportunidad. El usuario podrá completar el resto desde /proyectos/[id].
 */
export async function crearProyectoDesdeOportunidad(oportunidadId: string): Promise<ActionResult> {
  const autorizado = await getUsuarioConNivel(NIVELES_GESTION)
  if (!autorizado) return { success: false, error: ERROR_SIN_PERMISO }

  const supabase = await createClient()
  const { data: opo, error: errLeer } = await supabase
    .from('oportunidades')
    .select('id, titulo, empresa_id, empresa_grupo_id, valor_estimado, responsable_id, descripcion, etapa, proyecto_id')
    .eq('id', oportunidadId)
    .single()

  if (errLeer || !opo) return { success: false, error: 'Oportunidad no encontrada' }
  if (opo.proyecto_id) return { success: false, error: 'La oportunidad ya está vinculada a un proyecto' }
  if (opo.etapa !== 'Cerrada ganada') {
    return { success: false, error: 'Solo se puede crear proyecto desde oportunidades cerradas ganadas' }
  }

  // Insertar proyecto con datos mínimos. El estado inicial 'Confirmado' refleja que
  // ya hay un acuerdo comercial cerrado; el responsable se hereda de la oportunidad.
  const { data: nuevoProyecto, error: errProy } = await supabase
    .from('proyectos')
    .insert({
      empresa_id: opo.empresa_id,
      empresa_grupo_id: opo.empresa_grupo_id,
      titulo: opo.titulo,
      descripcion: opo.descripcion,
      tipo_proyecto: 'Facturable',
      tipo_partida: 'Puntual',
      estado: 'Confirmado',
      responsable_id: opo.responsable_id,
      ppto_estimado: opo.valor_estimado ?? 0,
    })
    .select('id')
    .single()

  if (errProy) return { success: false, error: `Error al crear el proyecto: ${errProy.message}` }

  // Vincular oportunidad al proyecto recién creado
  const { error: errVinc } = await supabase
    .from('oportunidades')
    .update({ proyecto_id: nuevoProyecto.id })
    .eq('id', oportunidadId)

  if (errVinc) return { success: false, error: `Proyecto creado pero error al vincular: ${errVinc.message}` }

  revalidatePath('/oportunidades')
  revalidatePath('/proyectos')
  revalidatePath('/empresas')
  void registrarAuditoria({
    persona: autorizado, accion: 'crear', tabla: 'proyectos',
    registroId: nuevoProyecto.id, datosExtra: { desde_oportunidad: oportunidadId },
  })
  return { success: true, id: nuevoProyecto.id }
}

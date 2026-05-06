'use server'

import { createClient } from '@/lib/supabase/server'
import {
  getPersonaAutenticada,
  NIVELES_GESTION,
  esCoordinadorOSuperior,
} from '@/lib/supabase/auth-helpers'
import {
  dedicacionSchema,
  ESTADOS_DEDICACION,
  type EstadoDedicacion,
} from '@/lib/schemas/dedicacion'
import { revalidatePath } from 'next/cache'
import { registrarAuditoria } from '@/lib/supabase/audit'
import type { ActionResult } from '@/lib/types/action-result'

const ERROR_SIN_PERMISO = 'No tienes permiso para esta acción'

// Estados en los que el autor puede editar/eliminar la dedicación.
const ESTADOS_EDITABLES: readonly EstadoDedicacion[] = ['Borrador', 'Revisar']

// Quién puede ejecutar cada transición.
//   'autor'             → solo el autor de la dedicación
//   'gestion'           → cualquier rol con nivel_acceso 'global' o 'empresa'
//                         (incluye Responsable, Coordinador, Director, Socio, Fundador, Administrador)
//   'coord_o_superior'  → Coordinador, Director o cualquier rol global (NO Responsable)
type Permiso = 'autor' | 'gestion' | 'coord_o_superior'
const REGLAS_TRANSICION: Array<{
  from: EstadoDedicacion
  to: EstadoDedicacion
  permiso: Permiso
}> = [
  { from: 'Borrador', to: 'Enviado', permiso: 'autor' },
  { from: 'Enviado',  to: 'Aprobado', permiso: 'gestion' },
  { from: 'Enviado',  to: 'Revisar', permiso: 'gestion' },
  { from: 'Revisar',  to: 'Enviado', permiso: 'autor' },
  { from: 'Aprobado', to: 'Enviado', permiso: 'coord_o_superior' },
]

function buscarRegla(origen: EstadoDedicacion, destino: EstadoDedicacion) {
  return REGLAS_TRANSICION.find((r) => r.from === origen && r.to === destino)
}

function esGestion(nivel: string): boolean {
  return NIVELES_GESTION.includes(nivel as typeof NIVELES_GESTION[number])
}

function permisoCumplido(
  permiso: Permiso,
  ctx: { esAutor: boolean; gestion: boolean; coordOSuperior: boolean },
): boolean {
  switch (permiso) {
    case 'autor':            return ctx.esAutor
    case 'gestion':          return ctx.gestion
    case 'coord_o_superior': return ctx.coordOSuperior
  }
}

// ────────────────────────────────────────────────────────────────
// CREAR
// ────────────────────────────────────────────────────────────────

export async function crearDedicacion(formData: unknown): Promise<ActionResult> {
  const persona = await getPersonaAutenticada()
  if (!persona) return { success: false, error: ERROR_SIN_PERMISO }

  const parsed = dedicacionSchema.safeParse(formData)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const data = parsed.data

  // Solo se pueden crear dedicaciones para uno mismo. El persona_id se ignora si llega
  // y se fuerza al usuario autenticado, evitando que se cree una dedicación a otro.
  const personaId = persona.id

  // Hora de inicio obligatoria al crear (las legacy con NULL solo se admiten al editar)
  if (!data.hora_inicio) {
    return { success: false, error: 'Selecciona la hora de inicio' }
  }

  const supabase = await createClient()

  // Autoconsistencia: si hay OT, el proyecto debe ser el de la OT. Lo resolvemos en servidor.
  let proyectoIdResuelto: string | null = data.proyecto_id || null
  const otId = data.orden_trabajo_id || null
  if (otId) {
    const { data: ot, error: errOt } = await supabase
      .from('ordenes_trabajo')
      .select('proyecto_id, deleted_at')
      .eq('id', otId)
      .single()

    if (errOt || !ot) return { success: false, error: 'OT no encontrada' }
    if (ot.deleted_at) return { success: false, error: 'La OT está eliminada' }
    proyectoIdResuelto = ot.proyecto_id
  }

  const { data: nueva, error } = await supabase
    .from('dedicaciones')
    .insert({
      persona_id: personaId,
      orden_trabajo_id: otId,
      proyecto_id: proyectoIdResuelto,
      fecha: data.fecha,
      hora_inicio: data.hora_inicio,
      horas: data.horas,
      descripcion: data.descripcion || null,
      tipo: data.tipo,
      estado: 'Borrador', // Toda dedicación nueva arranca en Borrador
    })
    .select('id')
    .single()

  if (error) return { success: false, error: `Error al crear la dedicación: ${error.message}` }

  revalidatePath('/dedicaciones')
  revalidatePath('/dashboard-personal')
  void registrarAuditoria({ persona, accion: 'crear', tabla: 'dedicaciones', registroId: nueva.id })
  return { success: true, id: nueva.id }
}

// ────────────────────────────────────────────────────────────────
// EDITAR
// Solo el autor puede editar, y solo en Borrador o Revisar.
// ────────────────────────────────────────────────────────────────

export async function editarDedicacion(id: string, formData: unknown): Promise<ActionResult> {
  const persona = await getPersonaAutenticada()
  if (!persona) return { success: false, error: ERROR_SIN_PERMISO }

  const parsed = dedicacionSchema.safeParse(formData)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const data = parsed.data
  const supabase = await createClient()

  const { data: actual, error: errLeer } = await supabase
    .from('dedicaciones')
    .select('persona_id, estado, deleted_at, hora_inicio')
    .eq('id', id)
    .single()

  if (errLeer || !actual) return { success: false, error: 'Dedicación no encontrada' }
  if (actual.deleted_at) return { success: false, error: 'Esta dedicación ya ha sido eliminada' }

  const esAutor = actual.persona_id === persona.id
  const estado = actual.estado as EstadoDedicacion

  if (!esAutor) {
    return { success: false, error: 'Solo el autor puede editar sus dedicaciones' }
  }
  if (!ESTADOS_EDITABLES.includes(estado)) {
    return {
      success: false,
      error: `Una dedicación en "${estado}" no se puede editar. Pásala primero a Borrador o Revisar.`,
    }
  }

  // Si la dedicación ya tenía hora_inicio configurada, no se puede dejar vacía.
  // Las legacy con hora_inicio NULL sí pueden quedarse así si el usuario no la fija.
  if (actual.hora_inicio != null && !data.hora_inicio) {
    return { success: false, error: 'Selecciona la hora de inicio' }
  }

  // Autoconsistencia OT ↔ proyecto
  let proyectoIdResuelto: string | null = data.proyecto_id || null
  const otId = data.orden_trabajo_id || null
  if (otId) {
    const { data: ot, error: errOt } = await supabase
      .from('ordenes_trabajo')
      .select('proyecto_id, deleted_at')
      .eq('id', otId)
      .single()
    if (errOt || !ot) return { success: false, error: 'OT no encontrada' }
    if (ot.deleted_at) return { success: false, error: 'La OT está eliminada' }
    proyectoIdResuelto = ot.proyecto_id
  }

  const { error } = await supabase
    .from('dedicaciones')
    .update({
      // persona_id no se modifica al editar: una dedicación pertenece para siempre a su autor
      orden_trabajo_id: otId,
      proyecto_id: proyectoIdResuelto,
      fecha: data.fecha,
      hora_inicio: data.hora_inicio || null,
      horas: data.horas,
      descripcion: data.descripcion || null,
      tipo: data.tipo,
    })
    .eq('id', id)

  if (error) return { success: false, error: `Error al actualizar la dedicación: ${error.message}` }

  revalidatePath('/dedicaciones')
  revalidatePath('/dashboard-personal')
  void registrarAuditoria({ persona, accion: 'actualizar', tabla: 'dedicaciones', registroId: id })
  return { success: true }
}

// ────────────────────────────────────────────────────────────────
// ELIMINAR (soft)
// Solo el autor, y solo en Borrador o Revisar.
// ────────────────────────────────────────────────────────────────

export async function eliminarDedicacion(id: string): Promise<ActionResult> {
  const persona = await getPersonaAutenticada()
  if (!persona) return { success: false, error: ERROR_SIN_PERMISO }

  const supabase = await createClient()

  const { data: actual, error: errLeer } = await supabase
    .from('dedicaciones')
    .select('persona_id, estado')
    .eq('id', id)
    .single()

  if (errLeer || !actual) return { success: false, error: 'Dedicación no encontrada' }

  const esAutor = actual.persona_id === persona.id
  const estado = actual.estado as EstadoDedicacion

  if (!esAutor) {
    return { success: false, error: 'Solo el autor puede eliminar sus dedicaciones' }
  }
  if (!ESTADOS_EDITABLES.includes(estado)) {
    return {
      success: false,
      error: `Una dedicación en "${estado}" no se puede eliminar. Pásala primero a Borrador o Revisar.`,
    }
  }

  const { error } = await supabase
    .from('dedicaciones')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)

  if (error) return { success: false, error: `Error al eliminar la dedicación: ${error.message}` }

  revalidatePath('/dedicaciones')
  revalidatePath('/dashboard-personal')
  void registrarAuditoria({ persona, accion: 'eliminar', tabla: 'dedicaciones', registroId: id })
  return { success: true }
}

// ────────────────────────────────────────────────────────────────
// CAMBIO DE ESTADO (individual)
// ────────────────────────────────────────────────────────────────

export async function cambiarEstadoDedicacion(id: string, nuevoEstado: string): Promise<ActionResult> {
  const persona = await getPersonaAutenticada()
  if (!persona) return { success: false, error: ERROR_SIN_PERMISO }

  if (!ESTADOS_DEDICACION.includes(nuevoEstado as EstadoDedicacion)) {
    return { success: false, error: 'Estado no válido' }
  }
  const destino = nuevoEstado as EstadoDedicacion

  const supabase = await createClient()
  const { data: actual, error: errLeer } = await supabase
    .from('dedicaciones')
    .select('persona_id, estado, deleted_at')
    .eq('id', id)
    .single()

  if (errLeer || !actual) return { success: false, error: 'Dedicación no encontrada' }
  if (actual.deleted_at) return { success: false, error: 'Esta dedicación ya ha sido eliminada' }

  const origen = actual.estado as EstadoDedicacion
  const regla = buscarRegla(origen, destino)
  if (!regla) {
    return { success: false, error: `No se puede pasar de "${origen}" a "${destino}"` }
  }

  const ctx = {
    esAutor: actual.persona_id === persona.id,
    gestion: esGestion(persona.rol.nivel_acceso),
    coordOSuperior: esCoordinadorOSuperior(persona.rol.nombre),
  }

  if (!permisoCumplido(regla.permiso, ctx)) {
    return { success: false, error: ERROR_SIN_PERMISO }
  }

  const update: Record<string, unknown> = { estado: destino }
  if (destino === 'Aprobado') update.aprobado_por_id = persona.id
  else update.aprobado_por_id = null

  const { error } = await supabase.from('dedicaciones').update(update).eq('id', id)
  if (error) return { success: false, error: `Error al cambiar el estado: ${error.message}` }

  revalidatePath('/dedicaciones')
  revalidatePath('/dashboard-personal')
  void registrarAuditoria({
    persona,
    accion: 'cambiar_estado',
    tabla: 'dedicaciones',
    registroId: id,
    datosExtra: { origen, destino },
  })
  return { success: true }
}

// ────────────────────────────────────────────────────────────────
// CAMBIO DE ESTADO (bulk)
// ────────────────────────────────────────────────────────────────
//
// Para cada destino el origen "natural" se inferre. La acción se aplica solo
// a las filas seleccionadas que vengan de ese origen y donde el usuario tenga
// permiso (mismas reglas que en el cambio individual).

const ORIGEN_BULK: Record<EstadoDedicacion, EstadoDedicacion | null> = {
  Borrador: null,        // no hay bulk hacia Borrador (autor lo hace 1:1 desde Revisar/Enviado)
  Enviado: 'Borrador',   // enviar bulk: Borrador → Enviado
  Aprobado: 'Enviado',   // aprobar bulk: Enviado → Aprobado
  Revisar: 'Enviado',    // mandar a revisar bulk: Enviado → Revisar
}

export async function cambiarEstadoBulk(ids: string[], nuevoEstado: string): Promise<ActionResult> {
  const persona = await getPersonaAutenticada()
  if (!persona) return { success: false, error: ERROR_SIN_PERMISO }

  if (ids.length === 0) return { success: false, error: 'No hay dedicaciones seleccionadas' }
  if (!ESTADOS_DEDICACION.includes(nuevoEstado as EstadoDedicacion)) {
    return { success: false, error: 'Estado no válido' }
  }

  const destino = nuevoEstado as EstadoDedicacion
  const origenEsperado = ORIGEN_BULK[destino]
  if (!origenEsperado) {
    return { success: false, error: 'Esta transición no admite acción en bulk' }
  }

  const regla = buscarRegla(origenEsperado, destino)
  if (!regla) return { success: false, error: 'Transición no permitida' }

  const ctx = {
    esAutor: true, // se valida fila a fila más abajo si la regla es 'autor'
    gestion: esGestion(persona.rol.nivel_acceso),
    coordOSuperior: esCoordinadorOSuperior(persona.rol.nombre),
  }

  // Si la regla requiere gestion/coord_o_superior, basta validarlo a nivel global.
  if (regla.permiso !== 'autor' && !permisoCumplido(regla.permiso, ctx)) {
    return { success: false, error: ERROR_SIN_PERMISO }
  }

  const supabase = await createClient()

  // Para regla 'autor': filtrar a las del propio usuario en el origen correcto.
  // Para gestion/coord_o_superior: aplica a todas las del origen correcto.
  let permitidosIds: string[]
  if (regla.permiso === 'autor') {
    const { data: filas, error: errLeer } = await supabase
      .from('dedicaciones')
      .select('id, persona_id, estado')
      .in('id', ids)
    if (errLeer) return { success: false, error: errLeer.message }
    permitidosIds = (filas ?? [])
      .filter((f) => f.estado === origenEsperado && f.persona_id === persona.id)
      .map((f) => f.id)
    if (permitidosIds.length === 0) {
      return { success: false, error: 'No hay dedicaciones válidas para esta acción' }
    }
  } else {
    permitidosIds = ids
  }

  const update: Record<string, unknown> = { estado: destino }
  if (destino === 'Aprobado') update.aprobado_por_id = persona.id
  else update.aprobado_por_id = null

  let q = supabase.from('dedicaciones').update(update).in('id', permitidosIds)
  if (regla.permiso !== 'autor') q = q.eq('estado', origenEsperado)
  const { error } = await q

  if (error) return { success: false, error: error.message }

  revalidatePath('/dedicaciones')
  revalidatePath('/dashboard-personal')
  void registrarAuditoria({
    persona,
    accion: 'cambiar_estado',
    tabla: 'dedicaciones',
    datosExtra: { ids: permitidosIds, destino, origenEsperado },
  })
  return { success: true }
}

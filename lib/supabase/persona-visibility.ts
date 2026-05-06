import 'server-only'
import { createClient } from './server'
import type { PersonaAutenticada } from './auth-helpers'

const ROLES_MULTI_EMPRESA = ['Fundador', 'Socio', 'Administrador'] as const
const ROLES_EMPRESA_COMPLETA = ['Director', 'Coordinador'] as const

/**
 * Devuelve los IDs de personas que el usuario autenticado puede seleccionar
 * en formularios (p.ej. el selector de persona en el form de dedicaciones).
 *
 * Reglas por rol:
 * - Fundador, Socio, Administrador → todas las personas activas del grupo.
 * - Director, Coordinador          → activas de su mismo empresa_grupo.
 * - Responsable                    → activas que comparten al menos un
 *                                    departamento (vía personas_departamentos)
 *                                    + sí misma.
 * - Cualquier otro                 → solo a sí misma.
 *
 * Siempre incluye a la persona autenticada por seguridad.
 */
export async function getPersonaIdsVisibles(
  persona: PersonaAutenticada,
): Promise<Set<string>> {
  const supabase = await createClient()
  const rol = persona.rol.nombre

  if ((ROLES_MULTI_EMPRESA as readonly string[]).includes(rol)) {
    const { data } = await supabase
      .from('personas')
      .select('id')
      .eq('activo', true)
    return new Set([persona.id, ...(data?.map((p) => p.id) ?? [])])
  }

  if ((ROLES_EMPRESA_COMPLETA as readonly string[]).includes(rol)) {
    const { data } = await supabase
      .from('personas')
      .select('id')
      .eq('activo', true)
      .eq('empresa_grupo_id', persona.empresa_grupo_id)
    return new Set([persona.id, ...(data?.map((p) => p.id) ?? [])])
  }

  if (rol === 'Responsable') {
    const { data: pds } = await supabase
      .from('personas_departamentos')
      .select('departamento_id')
      .eq('persona_id', persona.id)
    const deptIds = (pds ?? []).map((d) => d.departamento_id)
    if (deptIds.length === 0) return new Set([persona.id])

    const { data: miembros } = await supabase
      .from('personas_departamentos')
      .select('persona_id')
      .in('departamento_id', deptIds)
    return new Set([persona.id, ...((miembros ?? []).map((m) => m.persona_id))])
  }

  return new Set([persona.id])
}

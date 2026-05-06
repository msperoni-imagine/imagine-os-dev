import {
  getPersonas, getEmpresasGrupo, getRoles,
  getDepartamentos, getDivisiones, getPersonasDepartamentos,
} from '@/lib/supabase/queries'
import { createAdminClient } from '@/lib/supabase/admin'
import UsuariosClient from './usuarios-client'

/**
 * Devuelve el set de auth_user_ids que tienen cuenta auth pero NO han
 * confirmado todavía (invitación pendiente de aceptar).
 */
async function getAuthIdsPendientes(): Promise<string[]> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (error || !data?.users) {
      console.error('[usuarios] listUsers error:', error)
      return []
    }
    return data.users
      .filter((u) => !u.email_confirmed_at)
      .map((u) => u.id)
  } catch (e) {
    console.error('[usuarios] listUsers excepción:', e)
    return []
  }
}

export default async function UsuariosPage() {
  const [personas, empresasGrupo, roles, departamentos, divisiones, personasDepartamentos, authIdsPendientes] = await Promise.all([
    getPersonas(),
    getEmpresasGrupo(),
    getRoles(),
    getDepartamentos(),
    getDivisiones(),
    getPersonasDepartamentos(),
    getAuthIdsPendientes(),
  ])

  return (
    <UsuariosClient
      personas={personas}
      empresasGrupo={empresasGrupo}
      roles={roles}
      departamentos={departamentos}
      divisiones={divisiones}
      personasDepartamentos={personasDepartamentos}
      authIdsPendientes={authIdsPendientes}
    />
  )
}

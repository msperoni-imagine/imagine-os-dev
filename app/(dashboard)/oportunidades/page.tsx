import {
  getOportunidades,
  getEmpresas,
  getEmpresasGrupo,
  getContactosEmpresas,
  getPersonas,
  getProyectos,
} from '@/lib/supabase/queries'
import { OportunidadesClient } from './oportunidades-client'

export default async function OportunidadesPage() {
  const [
    oportunidades, empresas, empresasGrupo, contactos, personas, proyectos,
  ] = await Promise.all([
    getOportunidades(),
    getEmpresas(),
    getEmpresasGrupo(),
    getContactosEmpresas(),
    getPersonas(),
    getProyectos(),
  ])

  return (
    <OportunidadesClient
      oportunidades={oportunidades}
      empresas={empresas}
      empresasGrupo={empresasGrupo}
      contactos={contactos}
      personas={personas}
      proyectos={proyectos}
    />
  )
}

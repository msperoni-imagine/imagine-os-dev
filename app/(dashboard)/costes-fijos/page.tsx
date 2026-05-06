import {
  getCostesFijos,
  getCostesFijosDepartamentos,
  getCostesFijosPersonas,
  getEmpresasGrupo,
  getDepartamentos,
  getPersonas,
  getEmpresas,
} from '@/lib/supabase/queries'
import { CostesFijosClient } from './costes-fijos-client'

export default async function CostesFijosPage() {
  const [
    costesFijos, cfDepartamentos, cfPersonas,
    empresasGrupo, departamentos, personas, empresas,
  ] = await Promise.all([
    getCostesFijos(),
    getCostesFijosDepartamentos(),
    getCostesFijosPersonas(),
    getEmpresasGrupo(),
    getDepartamentos(),
    getPersonas(),
    getEmpresas(),
  ])

  return (
    <CostesFijosClient
      costesFijos={costesFijos}
      cfDepartamentos={cfDepartamentos}
      cfPersonas={cfPersonas}
      empresasGrupo={empresasGrupo}
      departamentos={departamentos}
      personas={personas}
      empresas={empresas}
    />
  )
}

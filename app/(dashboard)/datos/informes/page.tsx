import {
  getOrdenesTrabajo,
  getAsignaciones,
  getProyectos,
  getEmpresas,
  getPersonas,
  getCuotasPlanificacion,
  getDepartamentos,
  getCatalogoServicios,
  getEmpresasGrupo,
  getDedicaciones,
  getCondiciones,
} from '@/lib/supabase/queries'
import { InformesClient } from './informes-client'

export default async function InformesPage() {
  const [
    ordenes, asignaciones, proyectos, empresas,
    personas, cuotas, departamentos, servicios, empresasGrupo,
    dedicaciones, condiciones,
  ] = await Promise.all([
    getOrdenesTrabajo(),
    getAsignaciones(),
    getProyectos(),
    getEmpresas(),
    getPersonas(),
    getCuotasPlanificacion(),
    getDepartamentos(),
    getCatalogoServicios(),
    getEmpresasGrupo(),
    getDedicaciones(),
    getCondiciones(),
  ])

  return (
    <InformesClient
      ordenes={ordenes}
      asignaciones={asignaciones}
      proyectos={proyectos}
      empresas={empresas}
      personas={personas}
      cuotas={cuotas}
      departamentos={departamentos}
      servicios={servicios}
      empresasGrupo={empresasGrupo}
      dedicaciones={dedicaciones}
      condiciones={condiciones}
    />
  )
}

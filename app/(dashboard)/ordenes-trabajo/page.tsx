import {
  getOrdenesTrabajo,
  getOrdenesTrabajoPersonas,
  getProyectos,
  getCatalogoServicios,
  getEmpresas,
  getDepartamentos,
  getPersonas,
  getAsignaciones,
  getCuotasPlanificacion,
  getDedicaciones,
} from '@/lib/supabase/queries'
import { OrdenesTrabajoClient } from './ordenes-trabajo-client'

export default async function OrdenesTrabajoPage() {
  const [
    ordenesTrabajo,
    ordenesPersonas,
    proyectos,
    servicios,
    empresas,
    departamentos,
    personas,
    asignaciones,
    cuotas,
    dedicaciones,
  ] = await Promise.all([
    getOrdenesTrabajo(),
    getOrdenesTrabajoPersonas(),
    getProyectos(),
    getCatalogoServicios(),
    getEmpresas(),
    getDepartamentos(),
    getPersonas(),
    getAsignaciones(),
    getCuotasPlanificacion(),
    getDedicaciones(),
  ])

  return (
    <OrdenesTrabajoClient
      ordenesTrabajo={ordenesTrabajo}
      ordenesPersonas={ordenesPersonas}
      proyectos={proyectos}
      servicios={servicios}
      empresas={empresas}
      departamentos={departamentos}
      personas={personas}
      asignaciones={asignaciones}
      cuotas={cuotas}
      dedicaciones={dedicaciones}
    />
  )
}

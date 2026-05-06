import {
  getOrdenesTrabajo,
  getProyectos,
  getEmpresas,
  getEmpresasGrupo,
  getDepartamentos,
  getCatalogoServicios,
  getAsignaciones,
  getCuotasPlanificacion,
  getDedicaciones,
  getCondiciones,
} from '@/lib/supabase/queries'
import { PlanVsRealClient } from './plan-vs-real-client'

export default async function PlanVsRealPage() {
  const [
    ordenesTrabajo, proyectos, empresas, empresasGrupo, departamentos,
    servicios, asignaciones, cuotas, dedicaciones, condiciones,
  ] = await Promise.all([
    getOrdenesTrabajo(),
    getProyectos(),
    getEmpresas(),
    getEmpresasGrupo(),
    getDepartamentos(),
    getCatalogoServicios(),
    getAsignaciones(),
    getCuotasPlanificacion(),
    getDedicaciones(),
    getCondiciones(),
  ])

  return (
    <PlanVsRealClient
      ordenesTrabajo={ordenesTrabajo}
      proyectos={proyectos}
      empresas={empresas}
      empresasGrupo={empresasGrupo}
      departamentos={departamentos}
      servicios={servicios}
      asignaciones={asignaciones}
      cuotas={cuotas}
      dedicaciones={dedicaciones}
      condiciones={condiciones}
    />
  )
}

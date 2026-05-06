import { notFound } from 'next/navigation'
import {
  getProyectoById,
  getProyectos,
  getProyectosDepartamentosByProyecto,
  getOrdenesTrabajoByProyecto,
  getAsignaciones,
  getCatalogoServicios,
  getCuotasPlanificacion,
  getPersonas,
  getDepartamentos,
  getEmpresas,
  getEmpresasGrupo,
  getOrdenesTrabajoPersonas,
  getContactosEmpresas,
  getDedicacionesByProyecto,
  getOrdenesTrabajo,
} from '@/lib/supabase/queries'
import { getPersonaAutenticada } from '@/lib/supabase/auth-helpers'
import { getPersonaIdsVisibles } from '@/lib/supabase/persona-visibility'
import { ProyectoDetalleClient } from './proyecto-detalle-client'

export default async function ProyectoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const proyecto = await getProyectoById(id)
  if (!proyecto) notFound()

  const personaAutenticada = await getPersonaAutenticada()

  const [
    proyectos, proyDepts, ordenes, asignaciones, servicios, cuotas,
    personas, departamentos, empresas, empresasGrupo, ordenesPersonas,
    contactos, dedicaciones, todasOTs,
  ] = await Promise.all([
    getProyectos(),
    getProyectosDepartamentosByProyecto(id),
    getOrdenesTrabajoByProyecto(id),
    getAsignaciones(),
    getCatalogoServicios(),
    getCuotasPlanificacion(),
    getPersonas(),
    getDepartamentos(),
    getEmpresas(),
    getEmpresasGrupo(),
    getOrdenesTrabajoPersonas(),
    getContactosEmpresas(),
    getDedicacionesByProyecto(id),
    getOrdenesTrabajo(),
  ])

  const personasVisibles = personaAutenticada
    ? await (async () => {
        const ids = await getPersonaIdsVisibles(personaAutenticada)
        return personas.filter((p) => ids.has(p.id))
      })()
    : personas

  return (
    <ProyectoDetalleClient
      proyecto={proyecto}
      proyectos={proyectos}
      proyDepts={proyDepts}
      ordenes={ordenes}
      asignaciones={asignaciones}
      servicios={servicios}
      cuotas={cuotas}
      personas={personas}
      personasVisibles={personasVisibles}
      departamentos={departamentos}
      empresas={empresas}
      empresasGrupo={empresasGrupo}
      ordenesPersonas={ordenesPersonas}
      contactos={contactos}
      dedicaciones={dedicaciones}
      todasOrdenesTrabajo={todasOTs}
    />
  )
}

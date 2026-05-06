import { notFound } from 'next/navigation'
import {
  getPersonaById,
  getPersonasDepartamentos,
  getDepartamentos,
  getEmpresasGrupo,
  getRangosInternos,
  getPuestos,
  getDivisiones,
  getRoles,
  getCiudades,
  getOficinas,
  getAsignacionesByPersona,
  getCondicionesByPersona,
  getAusenciasByPersona,
  getOrdenesTrabajo,
  getProyectos,
  getEmpresas,
  getCatalogoServicios,
  getCuotasPlanificacion,
  getDedicacionesByPersona,
  getPersonas,
} from '@/lib/supabase/queries'
import { getPersonaAutenticada } from '@/lib/supabase/auth-helpers'
import { getPersonaIdsVisibles } from '@/lib/supabase/persona-visibility'
import { PersonaDetalleClient } from './persona-detalle-client'

export default async function PersonaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const persona = await getPersonaById(id)
  if (!persona) notFound()

  const personaAutenticada = await getPersonaAutenticada()

  const [
    personasDepts, departamentos, empresasGrupo, rangos, puestos,
    divisiones, roles, ciudades, oficinas, asignaciones,
    condiciones, ausencias,
    ordenesTrabajo, proyectos, empresas, servicios, cuotas,
    dedicaciones, personas,
  ] = await Promise.all([
    getPersonasDepartamentos(),
    getDepartamentos(),
    getEmpresasGrupo(),
    getRangosInternos(),
    getPuestos(),
    getDivisiones(),
    getRoles(),
    getCiudades(),
    getOficinas(),
    getAsignacionesByPersona(id),
    getCondicionesByPersona(id),
    getAusenciasByPersona(id),
    getOrdenesTrabajo(),
    getProyectos(),
    getEmpresas(),
    getCatalogoServicios(),
    getCuotasPlanificacion(),
    getDedicacionesByPersona(id),
    getPersonas(),
  ])

  const personasVisibles = personaAutenticada
    ? await (async () => {
        const ids = await getPersonaIdsVisibles(personaAutenticada)
        return personas.filter((p) => ids.has(p.id))
      })()
    : personas

  return (
    <PersonaDetalleClient
      persona={persona}
      personasDepts={personasDepts}
      departamentos={departamentos}
      empresasGrupo={empresasGrupo}
      rangos={rangos}
      puestos={puestos}
      divisiones={divisiones}
      roles={roles}
      ciudades={ciudades}
      oficinas={oficinas}
      asignaciones={asignaciones}
      condiciones={condiciones}
      ausencias={ausencias}
      ordenesTrabajo={ordenesTrabajo}
      proyectos={proyectos}
      empresas={empresas}
      servicios={servicios}
      cuotas={cuotas}
      dedicaciones={dedicaciones}
      personas={personas}
      personasVisibles={personasVisibles}
    />
  )
}

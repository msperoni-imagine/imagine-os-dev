import {
  getDedicaciones,
  getDedicacionesByPersona,
  getPersonas,
  getProyectos,
  getEmpresas,
  getEmpresasGrupo,
  getOrdenesTrabajo,
  getCatalogoServicios,
  getDepartamentos,
} from '@/lib/supabase/queries'
import { getPersonaAutenticada, esCoordinadorOSuperior } from '@/lib/supabase/auth-helpers'
import { getPersonaIdsVisibles } from '@/lib/supabase/persona-visibility'
import { DedicacionesClient } from './dedicaciones-client'

export default async function DedicacionesPage() {
  const personaAutenticada = await getPersonaAutenticada()

  // Los roles de nivel 'personal' (Miembro, Intern, Externo, Implant) solo ven sus
  // propias dedicaciones. El resto ve todas las no eliminadas. El middleware ya
  // bloquea accesos no autenticados, así que si llegamos sin persona hay un
  // problema de vinculación — mostramos la página vacía.
  const esPersonal = personaAutenticada?.rol.nivel_acceso === 'personal'

  const dedicacionesPromise =
    esPersonal && personaAutenticada
      ? getDedicacionesByPersona(personaAutenticada.id)
      : getDedicaciones()

  const [
    dedicaciones,
    personas,
    proyectos,
    empresas,
    empresasGrupo,
    ordenesTrabajo,
    servicios,
    departamentos,
  ] = await Promise.all([
    dedicacionesPromise,
    getPersonas(),
    getProyectos(),
    getEmpresas(),
    getEmpresasGrupo(),
    getOrdenesTrabajo(),
    getCatalogoServicios(),
    getDepartamentos(),
  ])

  // Subconjunto de personas seleccionables en el form (filtradas por rol).
  const personasVisibles = personaAutenticada
    ? await (async () => {
        const ids = await getPersonaIdsVisibles(personaAutenticada)
        return personas.filter((p) => ids.has(p.id))
      })()
    : personas

  return (
    <DedicacionesClient
      dedicaciones={dedicaciones}
      personas={personas}
      personasVisibles={personasVisibles}
      proyectos={proyectos}
      empresas={empresas}
      empresasGrupo={empresasGrupo}
      ordenesTrabajo={ordenesTrabajo}
      servicios={servicios}
      departamentos={departamentos}
      personaAutenticadaId={personaAutenticada?.id ?? null}
      nivelAcceso={personaAutenticada?.rol.nivel_acceso ?? 'personal'}
      esCoordOSuperior={personaAutenticada ? esCoordinadorOSuperior(personaAutenticada.rol.nombre) : false}
    />
  )
}

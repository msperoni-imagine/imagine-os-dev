'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { MonthNavigator } from '@/components/month-navigator'
import { StatusBadge } from '@/components/status-badge'
import { DedicacionesFormSheet } from '@/app/(dashboard)/dedicaciones/dedicaciones-form-sheet'
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table'
import type {
  Dedicacion, Persona, Proyecto, Empresa, OrdenTrabajo, CatalogoServicio,
  Asignacion, CuotaPlanificacion,
} from '@/lib/supabase/types'

function currentMonthIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function formatHoras(n: number): string {
  return n % 1 === 0 ? `${n}h` : `${n.toFixed(2)}h`
}

type BaseProps = {
  /** Dedicaciones ya prefiltradas por persona o proyecto (según modo). */
  dedicaciones: Dedicacion[]
  personas: Persona[]
  /** Subconjunto de personas que el usuario puede seleccionar en el form (filtrado por rol). */
  personasVisibles?: Persona[]
  proyectos: Proyecto[]
  empresas: Empresa[]
  ordenesTrabajo: OrdenTrabajo[]
  servicios: CatalogoServicio[]
  /** Limitar las filas mostradas (0/undefined = todas las del mes) */
  limitFilas?: number
  /** URL destino del enlace "Ver todas" (ej: `/dedicaciones?persona=xxx`) */
  linkVerTodas?: string
}

type PersonaMode = BaseProps & {
  mode: 'persona'
  personaId: string
  /**
   * Si se pasan asignaciones y cuotas, el componente calcula horas-plan del mes
   * para mostrar la comparativa plan-vs-real.
   */
  asignaciones?: Asignacion[]
  cuotas?: CuotaPlanificacion[]
}

type ProyectoMode = BaseProps & {
  mode: 'proyecto'
  proyectoId: string
}

type Props = PersonaMode | ProyectoMode

export function DedicacionesSection(props: Props) {
  const { dedicaciones, personas, personasVisibles, proyectos, empresas, ordenesTrabajo, servicios, limitFilas, linkVerTodas } = props
  const isPersona = props.mode === 'persona'

  const [mes, setMes] = useState(currentMonthIso())

  const personaMap = useMemo(() => new Map(personas.map((p) => [p.id, p])), [personas])
  const proyectoMap = useMemo(() => new Map(proyectos.map((p) => [p.id, p])), [proyectos])
  const empresaMap = useMemo(() => new Map(empresas.map((e) => [e.id, e])), [empresas])
  const otMap = useMemo(() => new Map(ordenesTrabajo.map((o) => [o.id, o])), [ordenesTrabajo])
  const servicioMap = useMemo(() => new Map(servicios.map((s) => [s.id, s])), [servicios])

  // Filtrar dedicaciones del mes seleccionado
  const delMes = useMemo(() => {
    return dedicaciones
      .filter((d) => d.fecha.slice(0, 7) + '-01' === mes)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [dedicaciones, mes])

  // Horas asignadas del mes (plan) — solo si estamos en modo persona con asignaciones+cuotas
  const horasAsignadasMes = useMemo(() => {
    if (props.mode !== 'persona' || !props.asignaciones || !props.cuotas) return undefined
    const cuotaMap = new Map(props.cuotas.map((c) => [c.id, c]))
    return props.asignaciones.reduce((sum, a) => {
      if (a.persona_id !== props.personaId) return sum
      const ot = otMap.get(a.orden_trabajo_id)
      if (!ot || ot.mes_anio !== mes) return sum
      const cuota = cuotaMap.get(a.cuota_planificacion_id)
      if (!cuota || cuota.precio_hora <= 0) return sum
      const ingresos = ot.partida_prevista * (a.porcentaje_ppto_tm / 100)
      return sum + ingresos / cuota.precio_hora
    }, 0)
  }, [props, otMap, mes])

  // KPIs
  const totalHoras = delMes.reduce((s, d) => s + Number(d.horas), 0)
  const horasPorAprobar = delMes
    .filter((d) => d.estado !== 'Aprobado')
    .reduce((s, d) => s + Number(d.horas), 0)
  const horasAprobadas = delMes
    .filter((d) => d.estado === 'Aprobado')
    .reduce((s, d) => s + Number(d.horas), 0)

  // Desglose por persona (solo en modo proyecto)
  const desglosePorPersona = useMemo(() => {
    if (props.mode !== 'proyecto') return null
    const acc = new Map<string, number>()
    for (const d of delMes) {
      acc.set(d.persona_id, (acc.get(d.persona_id) ?? 0) + Number(d.horas))
    }
    return Array.from(acc.entries())
      .map(([personaId, horas]) => ({
        personaId,
        nombre: personaMap.get(personaId)?.persona ?? '—',
        horas,
      }))
      .sort((a, b) => b.horas - a.horas)
  }, [delMes, personaMap, props.mode])

  // Filas enriquecidas para la tabla
  const filas = useMemo(() => {
    return delMes.map((d) => {
      const proyecto = d.proyecto_id ? proyectoMap.get(d.proyecto_id) : null
      const empresa = proyecto?.empresa_id ? empresaMap.get(proyecto.empresa_id) : null
      const ot = d.orden_trabajo_id ? otMap.get(d.orden_trabajo_id) : null
      const servicio = ot?.servicio_id ? servicioMap.get(ot.servicio_id) : null
      const persona = personaMap.get(d.persona_id)
      const clienteNombre = proyecto
        ? (empresa?.nombre_interno ?? empresa?.nombre_legal ?? 'Interno')
        : null
      return {
        ...d,
        personaNombre: persona?.persona ?? '—',
        proyectoTitulo: proyecto?.titulo ?? null,
        clienteNombre,
        servicioNombre: servicio?.nombre ?? null,
      }
    })
  }, [delMes, proyectoMap, empresaMap, otMap, servicioMap, personaMap])

  const visibles = limitFilas && limitFilas > 0 ? filas.slice(0, limitFilas) : filas
  const hayMas = limitFilas && limitFilas > 0 && filas.length > limitFilas

  return (
    <section className="rounded-xl bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Dedicaciones
          </h2>
          <MonthNavigator value={mes} onChange={setMes} />
        </div>
        {isPersona && (
          <DedicacionesFormSheet
            personas={personas}
            personasVisibles={personasVisibles}
            proyectos={proyectos}
            empresas={empresas}
            ordenesTrabajo={ordenesTrabajo}
            servicios={servicios}
            preselectedPersonaId={props.personaId}
          />
        )}
      </div>

      {/* Resumen */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <ResumenItem label="Total mes" value={formatHoras(totalHoras)} />
        <ResumenItem label="Por aprobar" value={formatHoras(horasPorAprobar)} tone="amber" />
        <ResumenItem label="Aprobadas" value={formatHoras(horasAprobadas)} tone="emerald" />
      </div>

      {/* Comparativa plan vs real (solo persona con asignaciones+cuotas) */}
      {props.mode === 'persona' && horasAsignadasMes !== undefined && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-4 py-2 text-sm">
          <span className="text-muted-foreground">
            Horas asignadas (plan): <b className="text-foreground">{formatHoras(horasAsignadasMes)}</b>
          </span>
          <span className="text-muted-foreground">
            Horas dedicadas (real): <b className="text-foreground">{formatHoras(totalHoras)}</b>
          </span>
          <DeltaBadge diff={totalHoras - horasAsignadasMes} />
        </div>
      )}

      {/* Desglose por persona (solo proyecto) */}
      {props.mode === 'proyecto' && desglosePorPersona && desglosePorPersona.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {desglosePorPersona.map((p) => (
            <span key={p.personaId} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs">
              <span className="text-foreground">{p.nombre}</span>
              <span className="font-semibold text-blue-600">{formatHoras(p.horas)}</span>
            </span>
          ))}
        </div>
      )}

      {/* Tabla */}
      <div className="mt-4">
        {visibles.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay dedicaciones en este mes.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                {isPersona ? (
                  <>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Proyecto</TableHead>
                  </>
                ) : (
                  <TableHead>Persona</TableHead>
                )}
                <TableHead>OT / Servicio</TableHead>
                <TableHead className="text-right">Horas</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm whitespace-nowrap">{r.fecha}</TableCell>
                  {isPersona ? (
                    <>
                      <TableCell className="text-sm">{r.clienteNombre ?? <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-sm">{r.proyectoTitulo ?? <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                    </>
                  ) : (
                    <TableCell className="text-sm">{r.personaNombre}</TableCell>
                  )}
                  <TableCell className="text-sm">{r.servicioNombre ?? <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-sm text-right font-medium">{formatHoras(Number(r.horas))}</TableCell>
                  <TableCell className="text-sm">{r.tipo}</TableCell>
                  <TableCell><StatusBadge status={r.estado} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Footer con link a la vista completa */}
      {(hayMas || linkVerTodas) && (
        <div className="mt-3 flex items-center justify-end">
          {linkVerTodas && (
            <Link href={linkVerTodas} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              {hayMas ? `Ver todas (${filas.length})` : 'Ver todas'}
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      )}
    </section>
  )
}

function ResumenItem({ label, value, tone }: { label: string; value: string; tone?: 'amber' | 'emerald' }) {
  const toneClass =
    tone === 'amber' ? 'text-amber-600'
    : tone === 'emerald' ? 'text-emerald-600'
    : 'text-foreground'
  return (
    <div className="rounded-lg bg-gray-50 px-4 py-3">
      <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-xl font-bold ${toneClass}`}>{value}</p>
    </div>
  )
}

function DeltaBadge({ diff }: { diff: number }) {
  const sign = diff >= 0 ? '+' : ''
  const color =
    diff === 0 ? 'text-muted-foreground'
    : Math.abs(diff) <= 2 ? 'text-emerald-600'
    : diff > 0 ? 'text-amber-600'
    : 'text-red-600'
  return (
    <span className={`text-sm font-semibold ${color}`}>
      Δ {sign}{formatHoras(diff)}
    </span>
  )
}

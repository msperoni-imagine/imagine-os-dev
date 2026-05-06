'use client'

import { Suspense, useMemo } from 'react'
import { MonthNavigator } from '@/components/month-navigator'
import { FilterSelect } from '@/components/filter-select'
import { SortableHeader } from '@/components/sortable-header'
import { KpiCard } from '@/components/kpi-card'
import { useTableState, sortData } from '@/hooks/use-table-state'
import { formatMoney } from '@/lib/helpers'
import {
  horasPlanOt, horasRealOt, calcularMargenOt, desviacionPct, tonoDesviacion,
} from '@/lib/helpers-margenes'
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table'
import type {
  OrdenTrabajo, Proyecto, Empresa, EmpresaGrupo, Departamento,
  CatalogoServicio, Asignacion, CuotaPlanificacion, Dedicacion, Condicion,
} from '@/lib/supabase/types'

type Props = {
  ordenesTrabajo: OrdenTrabajo[]
  proyectos: Proyecto[]
  empresas: Empresa[]
  empresasGrupo: EmpresaGrupo[]
  departamentos: Departamento[]
  servicios: CatalogoServicio[]
  asignaciones: Asignacion[]
  cuotas: CuotaPlanificacion[]
  dedicaciones: Dedicacion[]
  condiciones: Condicion[]
}

function currentMonthIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function formatHoras(n: number | null): string {
  if (n === null) return '—'
  return n % 1 === 0 ? `${n}h` : `${n.toFixed(1)}h`
}

function formatPct(n: number | null, digits = 0): string {
  if (n === null) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(digits)}%`
}

const toneClass: Record<'verde' | 'ambar' | 'rojo' | 'neutro', string> = {
  verde: 'text-emerald-600',
  ambar: 'text-amber-600',
  rojo: 'text-red-600',
  neutro: 'text-muted-foreground',
}

export function PlanVsRealClient(props: Props) {
  return (
    <Suspense>
      <PlanVsRealContent {...props} />
    </Suspense>
  )
}

function PlanVsRealContent({
  ordenesTrabajo, proyectos, empresas, empresasGrupo, departamentos,
  servicios, asignaciones, cuotas, dedicaciones, condiciones,
}: Props) {
  const proyectoMap = useMemo(() => new Map(proyectos.map((p) => [p.id, p])), [proyectos])
  const empresaMap = useMemo(() => new Map(empresas.map((e) => [e.id, e])), [empresas])
  const egMap = useMemo(() => new Map(empresasGrupo.map((e) => [e.id, e])), [empresasGrupo])
  const deptoMap = useMemo(() => new Map(departamentos.map((d) => [d.id, d])), [departamentos])
  const servicioMap = useMemo(() => new Map(servicios.map((s) => [s.id, s])), [servicios])
  const cuotaMap = useMemo(() => new Map(cuotas.map((c) => [c.id, c])), [cuotas])

  const { sortCol, sortDir, toggleSort, setParams, getParam } = useTableState({
    defaultSort: { col: 'desviacionPct', dir: 'desc' },
  })
  const mesUrl = getParam('mes')
  const mes = mesUrl && mesUrl.match(/^\d{4}-\d{2}-01$/) ? mesUrl : currentMonthIso()
  const egFilter = getParam('eg', 'Todos')!
  const deptoFilter = getParam('depto', 'Todos')!
  const proyectoFilter = getParam('proyecto', 'Todos')!

  // Opciones (cascada EG → depto)
  const egFilterId = useMemo(() => {
    if (egFilter === 'Todos') return null
    return empresasGrupo.find((e) => e.nombre === egFilter)?.id ?? null
  }, [egFilter, empresasGrupo])

  const filterOptions = useMemo(() => {
    const egs = ['Todos', ...empresasGrupo.map((e) => e.nombre).sort()]
    const deptosFiltrados = egFilterId
      ? departamentos.filter((d) => d.empresa_grupo_id === egFilterId)
      : departamentos
    const deptos = ['Todos', ...Array.from(new Set(deptosFiltrados.map((d) => d.nombre))).sort()]
    const proys = ['Todos', ...proyectos
      .filter((p) => !egFilterId || p.empresa_grupo_id === egFilterId)
      .map((p) => p.titulo)
      .sort()]
    return { egs, deptos, proyectos: proys }
  }, [empresasGrupo, departamentos, proyectos, egFilterId])

  // Filas: una por OT del mes
  const filas = useMemo(() => {
    const asigsById = new Map<string, Asignacion[]>()
    for (const a of asignaciones) {
      if (!asigsById.has(a.orden_trabajo_id)) asigsById.set(a.orden_trabajo_id, [])
      asigsById.get(a.orden_trabajo_id)!.push(a)
    }

    return ordenesTrabajo
      .filter((ot) => ot.mes_anio === mes)
      .map((ot) => {
        const proyecto = proyectoMap.get(ot.proyecto_id)
        const empresa = proyecto?.empresa_id ? empresaMap.get(proyecto.empresa_id) : null
        const depto = deptoMap.get(ot.departamento_id)
        const servicio = ot.servicio_id ? servicioMap.get(ot.servicio_id) : null
        const asigsOt = asigsById.get(ot.id) ?? []

        const horasPlan = horasPlanOt(ot, asigsOt, cuotaMap)
        const horasReal = horasRealOt(ot.id, dedicaciones)
        const deltaHoras = horasReal - horasPlan
        const deviacion = desviacionPct(horasReal, horasPlan)
        const margen = calcularMargenOt(ot, dedicaciones, condiciones)

        return {
          id: ot.id,
          proyectoTitulo: proyecto?.titulo ?? '—',
          clienteNombre: empresa ? (empresa.nombre_interno ?? empresa.nombre_legal) : 'Interno',
          empresaGrupoNombre: proyecto ? egMap.get(proyecto.empresa_grupo_id)?.nombre ?? '—' : '—',
          empresaGrupoId: proyecto?.empresa_grupo_id ?? null,
          departamentoNombre: depto?.nombre ?? '—',
          servicioNombre: servicio?.nombre ?? null,
          horasPlan,
          horasReal,
          deltaHoras,
          desviacionPct: deviacion,
          ingresos: margen.ingresosReales,
          costeReal: margen.costeReal,
          margenEur: margen.margenEur,
          margenPct: margen.margenPct,
          margenIncompleto: margen.incompleto,
          tipoPartida: proyecto?.tipo_partida ?? null,
        }
      })
  }, [ordenesTrabajo, mes, asignaciones, cuotaMap, dedicaciones, condiciones, proyectoMap, empresaMap, egMap, deptoMap, servicioMap])

  // Filtros
  const filtradas = filas.filter((f) => {
    if (egFilterId && f.empresaGrupoId !== egFilterId) return false
    if (deptoFilter !== 'Todos' && f.departamentoNombre !== deptoFilter) return false
    if (proyectoFilter !== 'Todos' && f.proyectoTitulo !== proyectoFilter) return false
    return true
  })

  // Orden
  const sorted = useMemo(() => sortData(filtradas, sortCol, sortDir, {
    proyectoTitulo: (f) => f.proyectoTitulo,
    clienteNombre: (f) => f.clienteNombre,
    horasPlan: (f) => f.horasPlan,
    horasReal: (f) => f.horasReal,
    deltaHoras: (f) => f.deltaHoras,
    desviacionPct: (f) => f.desviacionPct ?? 0,
    ingresos: (f) => f.ingresos ?? 0,
    costeReal: (f) => f.costeReal,
    margenEur: (f) => f.margenEur ?? 0,
    margenPct: (f) => f.margenPct ?? 0,
  }), [filtradas, sortCol, sortDir])

  // KPIs agregados del conjunto filtrado
  const totalHorasPlan = filtradas.reduce((s, f) => s + f.horasPlan, 0)
  const totalHorasReal = filtradas.reduce((s, f) => s + f.horasReal, 0)
  const totalIngresos = filtradas.reduce((s, f) => s + (f.ingresos ?? 0), 0)
  const totalCosteReal = filtradas.reduce((s, f) => s + f.costeReal, 0)
  const totalMargenEur = totalIngresos - totalCosteReal
  const margenMedioPct = totalIngresos > 0 ? (totalMargenEur / totalIngresos) * 100 : null
  const algunIncompleto = filtradas.some((f) => f.margenIncompleto)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <MonthNavigator value={mes} onChange={(m) => setParams({ mes: m })} />
      </div>

      {/* KPIs agregados */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Horas plan / real"
          value={`${formatHoras(totalHorasPlan)} / ${formatHoras(totalHorasReal)}`}
          subtitle={`Δ ${formatHoras(totalHorasReal - totalHorasPlan)}`}
        />
        <KpiCard
          label="Ingresos reales"
          value={formatMoney(totalIngresos)}
          borderColor="border-t-blue-500"
        />
        <KpiCard
          label="Coste real"
          value={formatMoney(totalCosteReal)}
          subtitle={algunIncompleto ? 'Incompleto (faltan condiciones)' : undefined}
          borderColor={algunIncompleto ? 'border-t-amber-500' : 'border-t-purple-500'}
        />
        <KpiCard
          label="Margen medio"
          value={margenMedioPct === null ? '—' : formatPct(margenMedioPct, 1)}
          subtitle={formatMoney(totalMargenEur)}
          borderColor={
            margenMedioPct === null ? 'border-t-gray-400'
            : margenMedioPct >= 30 ? 'border-t-emerald-500'
            : margenMedioPct >= 15 ? 'border-t-amber-500'
            : 'border-t-red-500'
          }
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 shadow-sm">
        <FilterSelect
          label="Empresa"
          options={filterOptions.egs}
          active={egFilter}
          onChange={(v) => setParams({ eg: v === 'Todos' ? null : v, depto: null })}
        />
        <FilterSelect
          label="Departamento"
          options={filterOptions.deptos}
          active={deptoFilter}
          onChange={(v) => setParams({ depto: v === 'Todos' ? null : v })}
        />
        <FilterSelect
          label="Proyecto"
          options={filterOptions.proyectos}
          active={proyectoFilter}
          onChange={(v) => setParams({ proyecto: v === 'Todos' ? null : v })}
        />
      </div>

      {/* Aviso si faltan condiciones */}
      {algunIncompleto && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Algunas personas no tienen <b>condiciones</b> con salario y horas/semana registradas.
          Las dedicaciones de esas personas se excluyen del cálculo de coste real y el margen
          mostrado puede estar sobrestimado.
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><SortableHeader label="Proyecto" column="proyectoTitulo" currentCol={sortCol} currentDir={sortDir} onToggle={toggleSort} /></TableHead>
              <TableHead><SortableHeader label="Cliente" column="clienteNombre" currentCol={sortCol} currentDir={sortDir} onToggle={toggleSort} /></TableHead>
              <TableHead>Servicio</TableHead>
              <TableHead className="text-right"><SortableHeader label="H. plan" column="horasPlan" currentCol={sortCol} currentDir={sortDir} onToggle={toggleSort} align="right" /></TableHead>
              <TableHead className="text-right"><SortableHeader label="H. real" column="horasReal" currentCol={sortCol} currentDir={sortDir} onToggle={toggleSort} align="right" /></TableHead>
              <TableHead className="text-right"><SortableHeader label="Δ horas" column="deltaHoras" currentCol={sortCol} currentDir={sortDir} onToggle={toggleSort} align="right" /></TableHead>
              <TableHead className="text-right"><SortableHeader label="Desv. %" column="desviacionPct" currentCol={sortCol} currentDir={sortDir} onToggle={toggleSort} align="right" /></TableHead>
              <TableHead className="text-right"><SortableHeader label="Ingresos" column="ingresos" currentCol={sortCol} currentDir={sortDir} onToggle={toggleSort} align="right" /></TableHead>
              <TableHead className="text-right"><SortableHeader label="Coste" column="costeReal" currentCol={sortCol} currentDir={sortDir} onToggle={toggleSort} align="right" /></TableHead>
              <TableHead className="text-right"><SortableHeader label="Margen €" column="margenEur" currentCol={sortCol} currentDir={sortDir} onToggle={toggleSort} align="right" /></TableHead>
              <TableHead className="text-right"><SortableHeader label="Margen %" column="margenPct" currentCol={sortCol} currentDir={sortDir} onToggle={toggleSort} align="right" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-12 text-center text-sm text-muted-foreground">
                  No hay órdenes de trabajo para este mes con los filtros aplicados.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((r) => {
                const tone = toneClass[tonoDesviacion(r.desviacionPct)]
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm font-medium">{r.proyectoTitulo}</TableCell>
                    <TableCell className="text-sm">{r.clienteNombre}</TableCell>
                    <TableCell className="text-sm">{r.servicioNombre ?? <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm text-right">{formatHoras(r.horasPlan)}</TableCell>
                    <TableCell className="text-sm text-right">{formatHoras(r.horasReal)}</TableCell>
                    <TableCell className={`text-sm text-right ${tone}`}>{formatHoras(r.deltaHoras)}</TableCell>
                    <TableCell className={`text-sm text-right font-medium ${tone}`}>{formatPct(r.desviacionPct, 0)}</TableCell>
                    <TableCell className="text-sm text-right text-muted-foreground">{r.ingresos === null ? '—' : formatMoney(r.ingresos)}</TableCell>
                    <TableCell className="text-sm text-right text-muted-foreground">
                      {r.margenIncompleto ? <span className="text-xs">Sin datos</span> : formatMoney(r.costeReal)}
                    </TableCell>
                    <TableCell className="text-sm text-right font-medium">{r.margenEur === null || r.margenIncompleto ? '—' : formatMoney(r.margenEur)}</TableCell>
                    <TableCell className="text-sm text-right font-medium">{r.margenPct === null || r.margenIncompleto ? '—' : formatPct(r.margenPct, 1)}</TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

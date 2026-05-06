'use client'

import { Suspense, useMemo, useState, useTransition } from 'react'
import { LayoutGrid, List, Loader2, TrendingUp, BarChart3 } from 'lucide-react'
import { useTableState, sortData } from '@/hooks/use-table-state'
import { formatMoney } from '@/lib/helpers'
import { KpiCard } from '@/components/kpi-card'
import { SearchBar } from '@/components/search-bar'
import { FilterSelect } from '@/components/filter-select'
import { MultiSelectFilter } from '@/components/multi-select-filter'
import { SortableHeader } from '@/components/sortable-header'
import { ClientePill } from '@/components/cliente-pill'
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table'
import { ETAPAS_OPORTUNIDAD, type EtapaOportunidad } from '@/lib/schemas/oportunidad'
import { OportunidadFormSheet } from './oportunidad-form-sheet'
import { cambiarEtapaOportunidad } from './actions'
import type {
  Oportunidad, Empresa, EmpresaGrupo, ContactoEmpresa, Persona, Proyecto,
} from '@/lib/supabase/types'

type Props = {
  oportunidades: Oportunidad[]
  empresas: Empresa[]
  empresasGrupo: EmpresaGrupo[]
  contactos: ContactoEmpresa[]
  personas: Persona[]
  proyectos: Proyecto[]
}

const ETAPA_COLOR: Record<EtapaOportunidad, string> = {
  'Prospección':       'bg-gray-50 text-gray-600 border-gray-300',
  'Propuesta enviada': 'bg-amber-50 text-amber-700 border-amber-300',
  'Negociación':       'bg-blue-50 text-blue-700 border-blue-300',
  'Verbal':            'bg-purple-50 text-purple-700 border-purple-300',
  'Cerrada ganada':    'bg-emerald-50 text-emerald-700 border-emerald-300',
  'Cerrada perdida':   'bg-red-50 text-red-700 border-red-300',
}

export function OportunidadesClient(props: Props) {
  return (
    <Suspense>
      <OportunidadesContent {...props} />
    </Suspense>
  )
}

function OportunidadesContent({
  oportunidades, empresas, empresasGrupo, contactos, personas, proyectos,
}: Props) {
  // Maps
  const empresaMap = useMemo(() => new Map(empresas.map((e) => [e.id, e])), [empresas])
  const egMap = useMemo(() => new Map(empresasGrupo.map((e) => [e.id, e])), [empresasGrupo])
  const personaMap = useMemo(() => new Map(personas.map((p) => [p.id, p])), [personas])

  // URL state
  const { sortCol, sortDir, toggleSort, setParams, getParam } = useTableState({
    defaultSort: { col: 'fecha_cierre_estimada', dir: 'asc' },
  })
  const vista = (getParam('vista', 'lista') as 'lista' | 'kanban' | 'forecast' | 'metricas')
  const egFilter = getParam('eg', 'Todos')!
  const responsableFilter = getParam('responsable', 'Todos')!
  const etapaFilters = useMemo(() => {
    const v = getParam('etapas')
    return v ? v.split(',') : []
  }, [getParam])

  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const egFilterId = useMemo(() => {
    if (egFilter === 'Todos') return null
    return empresasGrupo.find((e) => e.nombre === egFilter)?.id ?? null
  }, [egFilter, empresasGrupo])

  const responsableFilterId = useMemo(() => {
    if (responsableFilter === 'Todos') return null
    return personas.find((p) => p.persona === responsableFilter)?.id ?? null
  }, [responsableFilter, personas])

  // Enriquecer + filtrar
  const filas = useMemo(() => {
    return oportunidades.map((o) => {
      const empresa = empresaMap.get(o.empresa_id)
      const persona = personaMap.get(o.responsable_id)
      const eg = egMap.get(o.empresa_grupo_id)
      const valor = o.valor_estimado === null ? 0 : Number(o.valor_estimado)
      const prob = o.probabilidad_pct ?? 0
      return {
        ...o,
        clienteNombre: empresa ? (empresa.nombre_interno ?? empresa.nombre_legal) : '—',
        empresaGrupoNombre: eg?.nombre ?? '—',
        responsableNombre: persona?.persona ?? '—',
        valorNumerico: valor,
        valorPonderado: valor * (prob / 100),
      }
    })
  }, [oportunidades, empresaMap, personaMap, egMap])

  const filtradas = filas.filter((f) => {
    if (egFilterId && f.empresa_grupo_id !== egFilterId) return false
    if (responsableFilterId && f.responsable_id !== responsableFilterId) return false
    if (etapaFilters.length > 0 && !etapaFilters.includes(f.etapa)) return false
    if (search) {
      const q = search.toLowerCase()
      const matches =
        f.titulo.toLowerCase().includes(q) ||
        f.clienteNombre.toLowerCase().includes(q) ||
        f.responsableNombre.toLowerCase().includes(q) ||
        (f.descripcion ?? '').toLowerCase().includes(q)
      if (!matches) return false
    }
    return true
  })

  const sorted = useMemo(() => sortData(filtradas, sortCol, sortDir, {
    titulo: (f) => f.titulo,
    clienteNombre: (f) => f.clienteNombre,
    valorNumerico: (f) => f.valorNumerico,
    valorPonderado: (f) => f.valorPonderado,
    probabilidad_pct: (f) => f.probabilidad_pct ?? 0,
    etapa: (f) => f.etapa,
    responsableNombre: (f) => f.responsableNombre,
    fecha_cierre_estimada: (f) => f.fecha_cierre_estimada ?? '9999-99-99',
  }), [filtradas, sortCol, sortDir])

  // KPIs
  const abiertas = filtradas.filter((f) => f.etapa !== 'Cerrada ganada' && f.etapa !== 'Cerrada perdida')
  const cerradas = filtradas.filter((f) => f.etapa === 'Cerrada ganada' || f.etapa === 'Cerrada perdida')
  const ganadas = filtradas.filter((f) => f.etapa === 'Cerrada ganada')
  const totalPipeline = abiertas.reduce((s, f) => s + f.valorNumerico, 0)
  const totalPonderado = abiertas.reduce((s, f) => s + f.valorPonderado, 0)
  const winRate = cerradas.length > 0 ? (ganadas.length / cerradas.length) * 100 : null

  // ── Forecast (próximos 6 meses, opps activas con fecha estimada) ──
  const forecastData = useMemo(() => {
    const hoy = new Date()
    const meses: { iso: string; label: string; nOpp: number; valor: number; ponderado: number }[] = []
    for (let i = 0; i < 6; i++) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1)
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }).toUpperCase()
      const oppMes = filtradas.filter((f) => {
        if (f.etapa === 'Cerrada ganada' || f.etapa === 'Cerrada perdida') return false
        if (!f.fecha_cierre_estimada) return false
        return f.fecha_cierre_estimada.slice(0, 7) === iso
      })
      meses.push({
        iso, label,
        nOpp: oppMes.length,
        valor: oppMes.reduce((s, o) => s + o.valorNumerico, 0),
        ponderado: oppMes.reduce((s, o) => s + o.valorPonderado, 0),
      })
    }
    return meses
  }, [filtradas])

  // ── Funnel (distribución actual por etapa) ──
  const funnelData = useMemo(() => {
    return ETAPAS_OPORTUNIDAD.map((etapa) => {
      const opps = filtradas.filter((f) => f.etapa === etapa)
      return {
        etapa,
        count: opps.length,
        valor: opps.reduce((s, o) => s + o.valorNumerico, 0),
      }
    })
  }, [filtradas])
  const funnelMax = Math.max(...funnelData.map((d) => d.count), 1)

  // ── Métricas comerciales ──
  const metricasComerciales = useMemo(() => {
    // Tiempo medio cierre: días entre created_at y fecha_cierre_real
    const ganadasConFechas = ganadas.filter((g) => g.fecha_cierre_real)
    const tiempoMedioCierre = ganadasConFechas.length > 0
      ? Math.round(
          ganadasConFechas.reduce((s, g) => {
            const created = new Date(g.created_at).getTime()
            const closed = new Date(g.fecha_cierre_real!).getTime()
            return s + (closed - created) / (1000 * 60 * 60 * 24)
          }, 0) / ganadasConFechas.length,
        )
      : null

    const ticketMedio = ganadas.length > 0
      ? ganadas.reduce((s, g) => s + g.valorNumerico, 0) / ganadas.length
      : null

    // Win rate por responsable (solo entre cerradas)
    const porResp = new Map<string, { id: string; nombre: string; ganadas: number; total: number; valorGanado: number }>()
    for (const o of cerradas) {
      const ent = porResp.get(o.responsable_id) ?? { id: o.responsable_id, nombre: o.responsableNombre, ganadas: 0, total: 0, valorGanado: 0 }
      ent.total += 1
      if (o.etapa === 'Cerrada ganada') {
        ent.ganadas += 1
        ent.valorGanado += o.valorNumerico
      }
      porResp.set(o.responsable_id, ent)
    }
    const winRatePorResp = Array.from(porResp.values())
      .map((r) => ({ ...r, winRate: r.total > 0 ? (r.ganadas / r.total) * 100 : 0 }))
      .sort((a, b) => b.total - a.total)

    return { tiempoMedioCierre, ticketMedio, winRatePorResp }
  }, [ganadas, cerradas])

  // Opciones filtros
  const filterOptions = useMemo(() => ({
    egs: ['Todos', ...empresasGrupo.map((e) => e.nombre).sort()],
    responsables: ['Todos', ...Array.from(new Set(personas.filter((p) => p.activo).map((p) => p.persona))).sort()],
  }), [empresasGrupo, personas])

  // Cambio rápido de etapa desde la card del kanban
  function handleQuickEtapa(id: string, nueva: EtapaOportunidad, requiereMotivo: boolean) {
    setError(null)
    let motivo: string | undefined
    if (requiereMotivo) {
      const r = window.prompt('Motivo de la pérdida:')
      if (!r || r.trim().length === 0) return
      motivo = r.trim()
    } else {
      if (!confirm(`¿Mover a "${nueva}"?`)) return
    }
    startTransition(async () => {
      const result = await cambiarEtapaOportunidad(id, nueva, motivo)
      if (!result.success) setError(result.error ?? 'Error desconocido')
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Oportunidades</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pipeline comercial: oportunidades abiertas y su evolución hasta el cierre.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle vista */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-white p-0.5">
            <button
              onClick={() => setParams({ vista: null })}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                vista === 'lista' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50'
              }`}
            >
              <List className="h-3.5 w-3.5" /> Lista
            </button>
            <button
              onClick={() => setParams({ vista: 'kanban' })}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                vista === 'kanban' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Kanban
            </button>
            <button
              onClick={() => setParams({ vista: 'forecast' })}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                vista === 'forecast' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50'
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5" /> Forecast
            </button>
            <button
              onClick={() => setParams({ vista: 'metricas' })}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                vista === 'metricas' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" /> Métricas
            </button>
          </div>
          <OportunidadFormSheet
            empresas={empresas}
            empresasGrupo={empresasGrupo}
            contactos={contactos}
            personas={personas}
            proyectos={proyectos}
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Pipeline abierto" value={formatMoney(totalPipeline)} subtitle={`${abiertas.length} oportunidades`} />
        <KpiCard label="Valor ponderado" value={formatMoney(totalPonderado)} subtitle="valor × probabilidad" borderColor="border-t-blue-500" />
        <KpiCard label="Cerradas ganadas" value={ganadas.length} subtitle={`de ${cerradas.length} cerradas`} borderColor="border-t-emerald-500" />
        <KpiCard
          label="Win rate"
          value={winRate === null ? '—' : `${winRate.toFixed(0)}%`}
          subtitle="ganadas / cerradas"
          borderColor={
            winRate === null ? 'border-t-gray-400'
            : winRate >= 50 ? 'border-t-emerald-500'
            : winRate >= 25 ? 'border-t-amber-500'
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
          onChange={(v) => setParams({ eg: v === 'Todos' ? null : v })}
        />
        <MultiSelectFilter
          label="Etapa"
          options={ETAPAS_OPORTUNIDAD.map((e) => ({ value: e, label: e }))}
          selected={etapaFilters}
          onChange={(v) => setParams({ etapas: v.length > 0 ? v.join(',') : null })}
        />
        <FilterSelect
          label="Responsable"
          options={filterOptions.responsables}
          active={responsableFilter}
          onChange={(v) => setParams({ responsable: v === 'Todos' ? null : v })}
        />
        <div className="min-w-[220px] flex-1">
          <SearchBar
            placeholder="Buscar por título, cliente, responsable..."
            value={search}
            onChange={setSearch}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Vista lista */}
      {vista === 'lista' && (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortableHeader label="Título" column="titulo" currentCol={sortCol} currentDir={sortDir} onToggle={toggleSort} /></TableHead>
                <TableHead><SortableHeader label="Cliente" column="clienteNombre" currentCol={sortCol} currentDir={sortDir} onToggle={toggleSort} /></TableHead>
                <TableHead className="text-right"><SortableHeader label="Valor" column="valorNumerico" currentCol={sortCol} currentDir={sortDir} onToggle={toggleSort} align="right" /></TableHead>
                <TableHead className="text-right"><SortableHeader label="Prob." column="probabilidad_pct" currentCol={sortCol} currentDir={sortDir} onToggle={toggleSort} align="right" /></TableHead>
                <TableHead className="text-right"><SortableHeader label="Ponderado" column="valorPonderado" currentCol={sortCol} currentDir={sortDir} onToggle={toggleSort} align="right" /></TableHead>
                <TableHead><SortableHeader label="Etapa" column="etapa" currentCol={sortCol} currentDir={sortDir} onToggle={toggleSort} /></TableHead>
                <TableHead><SortableHeader label="Responsable" column="responsableNombre" currentCol={sortCol} currentDir={sortDir} onToggle={toggleSort} /></TableHead>
                <TableHead><SortableHeader label="Cierre est." column="fecha_cierre_estimada" currentCol={sortCol} currentDir={sortDir} onToggle={toggleSort} /></TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center text-sm text-muted-foreground">
                    No hay oportunidades con los filtros aplicados.
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm font-medium">{r.titulo}</TableCell>
                    <TableCell><ClientePill name={r.clienteNombre} /></TableCell>
                    <TableCell className="text-sm text-right">{formatMoney(r.valorNumerico)}</TableCell>
                    <TableCell className="text-sm text-right">{r.probabilidad_pct ?? '—'}{r.probabilidad_pct !== null ? '%' : ''}</TableCell>
                    <TableCell className="text-sm text-right font-medium text-blue-600">{formatMoney(r.valorPonderado)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${ETAPA_COLOR[r.etapa as EtapaOportunidad] ?? ''}`}>
                        {r.etapa}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{r.responsableNombre}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{r.fecha_cierre_estimada ?? '—'}</TableCell>
                    <TableCell className="text-right">
                      <OportunidadFormSheet
                        empresas={empresas}
                        empresasGrupo={empresasGrupo}
                        contactos={contactos}
                        personas={personas}
                        proyectos={proyectos}
                        oportunidad={r}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Vista kanban */}
      {vista === 'kanban' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          {ETAPAS_OPORTUNIDAD.map((etapa) => {
            const cards = filtradas
              .filter((f) => f.etapa === etapa)
              .sort((a, b) => (a.fecha_cierre_estimada ?? '9999').localeCompare(b.fecha_cierre_estimada ?? '9999'))
            const totalCol = cards.reduce((s, c) => s + c.valorNumerico, 0)
            return (
              <div key={etapa} className="rounded-xl bg-gray-50 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${ETAPA_COLOR[etapa]}`}>
                    {etapa}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{cards.length} · {formatMoney(totalCol)}</span>
                </div>
                <div className="space-y-2">
                  {cards.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">Sin oportunidades</p>
                  ) : (
                    cards.map((c) => (
                      <div key={c.id} className="group rounded-lg border border-border bg-white p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-tight">{c.titulo}</p>
                          <OportunidadFormSheet
                            empresas={empresas}
                            empresasGrupo={empresasGrupo}
                            contactos={contactos}
                            personas={personas}
                            proyectos={proyectos}
                            oportunidad={c}
                          />
                        </div>
                        <div className="mt-1.5">
                          <ClientePill name={c.clienteNombre} />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-blue-600">{formatMoney(c.valorNumerico)}</span>
                          <span className="text-muted-foreground">{c.probabilidad_pct ?? '—'}%</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{c.responsableNombre}</span>
                          {c.fecha_cierre_estimada && <span>{c.fecha_cierre_estimada}</span>}
                        </div>
                        {/* Quick move */}
                        <div className="mt-2 hidden gap-1 group-hover:flex">
                          <select
                            className="w-full rounded border border-border bg-white px-1.5 py-0.5 text-[10px]"
                            value={c.etapa}
                            disabled={isPending}
                            onChange={(e) => {
                              const nueva = e.target.value as EtapaOportunidad
                              if (nueva === c.etapa) return
                              handleQuickEtapa(c.id, nueva, nueva === 'Cerrada perdida')
                            }}
                          >
                            {ETAPAS_OPORTUNIDAD.map((e) => (
                              <option key={e} value={e}>{e}</option>
                            ))}
                          </select>
                          {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Vista forecast */}
      {vista === 'forecast' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-foreground">Forecast — próximos 6 meses</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Oportunidades activas (no cerradas) agrupadas por <code>fecha_cierre_estimada</code>.
                Valor ponderado = valor estimado × probabilidad / 100.
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead className="text-right">Nº oportunidades</TableHead>
                  <TableHead className="text-right">Valor total</TableHead>
                  <TableHead className="text-right">Valor ponderado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forecastData.map((m) => (
                  <TableRow key={m.iso}>
                    <TableCell className="text-sm font-medium">{m.label}</TableCell>
                    <TableCell className="text-sm text-right">{m.nOpp}</TableCell>
                    <TableCell className="text-sm text-right">{formatMoney(m.valor)}</TableCell>
                    <TableCell className="text-sm text-right font-semibold text-blue-600">{formatMoney(m.ponderado)}</TableCell>
                  </TableRow>
                ))}
                {/* Totales */}
                <TableRow className="border-t-2 border-border bg-gray-50">
                  <TableCell className="text-sm font-bold">Total 6 meses</TableCell>
                  <TableCell className="text-sm text-right font-bold">
                    {forecastData.reduce((s, m) => s + m.nOpp, 0)}
                  </TableCell>
                  <TableCell className="text-sm text-right font-bold">
                    {formatMoney(forecastData.reduce((s, m) => s + m.valor, 0))}
                  </TableCell>
                  <TableCell className="text-sm text-right font-bold text-blue-600">
                    {formatMoney(forecastData.reduce((s, m) => s + m.ponderado, 0))}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Vista métricas */}
      {vista === 'metricas' && (
        <div className="space-y-4">
          {/* KPI cards comerciales */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard
              label="Tiempo medio de cierre"
              value={metricasComerciales.tiempoMedioCierre === null ? '—' : `${metricasComerciales.tiempoMedioCierre} días`}
              subtitle={`${ganadas.length} ganadas con fecha`}
              borderColor="border-t-blue-500"
            />
            <KpiCard
              label="Ticket medio (ganado)"
              value={metricasComerciales.ticketMedio === null ? '—' : formatMoney(metricasComerciales.ticketMedio)}
              subtitle={`Valor estimado · ${ganadas.length} ganadas`}
              borderColor="border-t-emerald-500"
            />
            <KpiCard
              label="Total ganado"
              value={formatMoney(ganadas.reduce((s, g) => s + g.valorNumerico, 0))}
              subtitle={`${ganadas.length} oportunidades`}
              borderColor="border-t-purple-500"
            />
          </div>

          {/* Funnel — distribución actual por etapa */}
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-foreground">Funnel — distribución por etapa</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Distribución actual de las oportunidades en cada etapa del pipeline.
              </p>
            </div>
            <div className="space-y-2">
              {funnelData.map((f) => {
                const pctWidth = f.count > 0 ? (f.count / funnelMax) * 100 : 0
                return (
                  <div key={f.etapa} className="flex items-center gap-3">
                    <div className="w-40 shrink-0">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${ETAPA_COLOR[f.etapa] ?? ''}`}>
                        {f.etapa}
                      </span>
                    </div>
                    <div className="relative flex-1 h-6 rounded bg-gray-100 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all"
                        style={{ width: `${pctWidth}%` }}
                      />
                      <span className="absolute inset-0 flex items-center px-2 text-xs font-semibold text-foreground mix-blend-difference">
                        {f.count > 0 ? `${f.count} · ${formatMoney(f.valor)}` : ''}
                      </span>
                    </div>
                    <div className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                      {f.count}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Win rate por responsable */}
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-foreground">Win rate por responsable</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Porcentaje de oportunidades cerradas con éxito sobre el total de cerradas (ganadas + perdidas).
              </p>
            </div>
            {metricasComerciales.winRatePorResp.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Aún no hay oportunidades cerradas para calcular el win rate.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Responsable</TableHead>
                    <TableHead className="text-right">Ganadas</TableHead>
                    <TableHead className="text-right">Cerradas</TableHead>
                    <TableHead className="text-right">Win rate</TableHead>
                    <TableHead className="text-right">Valor ganado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metricasComerciales.winRatePorResp.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm font-medium">{r.nombre}</TableCell>
                      <TableCell className="text-sm text-right">{r.ganadas}</TableCell>
                      <TableCell className="text-sm text-right">{r.total}</TableCell>
                      <TableCell className={`text-sm text-right font-semibold ${
                        r.winRate >= 50 ? 'text-emerald-600' : r.winRate >= 25 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {r.winRate.toFixed(0)}%
                      </TableCell>
                      <TableCell className="text-sm text-right">{formatMoney(r.valorGanado)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

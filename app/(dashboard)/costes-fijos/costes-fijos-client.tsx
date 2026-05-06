'use client'

import { Suspense, useMemo, useState } from 'react'
import { MonthNavigator } from '@/components/month-navigator'
import { FilterSelect } from '@/components/filter-select'
import { MultiSelectFilter } from '@/components/multi-select-filter'
import { SearchBar } from '@/components/search-bar'
import { SortableHeader } from '@/components/sortable-header'
import { KpiCard } from '@/components/kpi-card'
import { useTableState, sortData } from '@/hooks/use-table-state'
import { formatMoney } from '@/lib/helpers'
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from '@/components/ui/table'
import { CATEGORIAS_COSTE } from '@/lib/schemas/coste-fijo'
import { CosteFijoFormSheet } from './coste-fijo-form-sheet'
import type {
  CosteFijo, CosteFijoDepartamento, CosteFijoPersona,
  EmpresaGrupo, Departamento, Persona, Empresa,
} from '@/lib/supabase/types'

type Props = {
  costesFijos: CosteFijo[]
  cfDepartamentos: CosteFijoDepartamento[]
  cfPersonas: CosteFijoPersona[]
  empresasGrupo: EmpresaGrupo[]
  departamentos: Departamento[]
  personas: Persona[]
  empresas: Empresa[]
}

function currentMonthIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function CostesFijosClient(props: Props) {
  return (
    <Suspense>
      <CostesFijosContent {...props} />
    </Suspense>
  )
}

function CostesFijosContent({
  costesFijos, cfDepartamentos, cfPersonas,
  empresasGrupo, departamentos, personas, empresas,
}: Props) {
  // Maps
  const egMap = useMemo(() => new Map(empresasGrupo.map((e) => [e.id, e])), [empresasGrupo])
  const empresaMap = useMemo(() => new Map(empresas.map((e) => [e.id, e])), [empresas])
  const deptoMap = useMemo(() => new Map(departamentos.map((d) => [d.id, d])), [departamentos])
  const personaMap = useMemo(() => new Map(personas.map((p) => [p.id, p])), [personas])

  // Índices N:M por coste_fijo_id
  const deptosByCoste = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const r of cfDepartamentos) {
      const arr = m.get(r.coste_fijo_id) ?? []
      arr.push(r.departamento_id)
      m.set(r.coste_fijo_id, arr)
    }
    return m
  }, [cfDepartamentos])
  const personasByCoste = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const r of cfPersonas) {
      const arr = m.get(r.coste_fijo_id) ?? []
      arr.push(r.persona_id)
      m.set(r.coste_fijo_id, arr)
    }
    return m
  }, [cfPersonas])

  // ── URL state ────────────────────────────────────────────────
  const { sortCol, sortDir, toggleSort, setParams, getParam } = useTableState({
    defaultSort: { col: 'mes_inicio', dir: 'desc' },
  })
  const mesUrl = getParam('mes')
  const mes = mesUrl && mesUrl.match(/^\d{4}-\d{2}-01$/) ? mesUrl : currentMonthIso()
  const egFilter = getParam('eg', 'Todos')!
  const categoriaFilters = useMemo(() => {
    const v = getParam('categoria')
    return v ? v.split(',') : []
  }, [getParam])
  const recurrenteFilter = getParam('recurrente', 'Todos')!

  const [search, setSearch] = useState('')

  // EG seleccionada → id
  const egFilterId = useMemo(() => {
    if (egFilter === 'Todos') return null
    return empresasGrupo.find((e) => e.nombre === egFilter)?.id ?? null
  }, [egFilter, empresasGrupo])

  // Filas vigentes en el mes seleccionado:
  //   - No recurrentes con mes_inicio = mes.
  //   - Recurrentes con mes_inicio <= mes AND (mes_fin IS NULL OR mes_fin >= mes).
  const filas = useMemo(() => {
    return costesFijos
      .filter((c) => {
        if (c.recurrente) {
          if (c.mes_inicio > mes) return false
          if (c.mes_fin && c.mes_fin < mes) return false
          return true
        }
        return c.mes_inicio === mes
      })
      .map((c) => ({
        ...c,
        empresaGrupoNombre: egMap.get(c.empresa_grupo_id)?.nombre ?? '—',
        empresaClienteNombre: c.empresa_id
          ? (empresaMap.get(c.empresa_id)?.nombre_interno ?? empresaMap.get(c.empresa_id)?.nombre_legal ?? '—')
          : null,
        departamentoIds: deptosByCoste.get(c.id) ?? [],
        personaIds: personasByCoste.get(c.id) ?? [],
      }))
  }, [costesFijos, mes, egMap, empresaMap, deptosByCoste, personasByCoste])

  // Filtros
  const filtradas = filas.filter((c) => {
    if (egFilterId && c.empresa_grupo_id !== egFilterId) return false
    if (categoriaFilters.length > 0 && !categoriaFilters.includes(c.categoria)) return false
    if (recurrenteFilter === 'Recurrente' && !c.recurrente) return false
    if (recurrenteFilter === 'Puntual' && c.recurrente) return false
    if (search) {
      const q = search.toLowerCase()
      const matches =
        c.concepto.toLowerCase().includes(q) ||
        (c.notas ?? '').toLowerCase().includes(q) ||
        (c.empresaClienteNombre ?? '').toLowerCase().includes(q)
      if (!matches) return false
    }
    return true
  })

  const sorted = useMemo(() => sortData(filtradas, sortCol, sortDir, {
    concepto: (r) => r.concepto,
    categoria: (r) => r.categoria,
    importe: (r) => Number(r.importe),
    mes_inicio: (r) => r.mes_inicio,
    empresaGrupoNombre: (r) => r.empresaGrupoNombre,
  }), [filtradas, sortCol, sortDir])

  // KPIs
  const totalMes = filtradas.reduce((s, c) => s + Number(c.importe), 0)
  const recurrentesMes = filtradas.filter((c) => c.recurrente).reduce((s, c) => s + Number(c.importe), 0)
  const puntualesMes = filtradas.filter((c) => !c.recurrente).reduce((s, c) => s + Number(c.importe), 0)

  // Top categoría
  const porCategoria = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of filtradas) {
      m.set(c.categoria, (m.get(c.categoria) ?? 0) + Number(c.importe))
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
  }, [filtradas])
  const topCategoria = porCategoria[0]

  // Opciones filtros
  const filterOptions = useMemo(() => ({
    egs: ['Todos', ...empresasGrupo.map((e) => e.nombre).sort()],
    recurrente: ['Todos', 'Recurrente', 'Puntual'],
  }), [empresasGrupo])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Costes fijos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Costes operativos mensuales (alquiler, software, móviles, freelancers...). Los recurrentes se mantienen vigentes hasta su mes fin.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <MonthNavigator value={mes} onChange={(m) => setParams({ mes: m })} />
          <CosteFijoFormSheet
            empresasGrupo={empresasGrupo}
            departamentos={departamentos}
            personas={personas}
            empresas={empresas}
          />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total mes" value={formatMoney(totalMes)} subtitle={`${filtradas.length} costes`} />
        <KpiCard label="Recurrentes" value={formatMoney(recurrentesMes)} borderColor="border-t-blue-500" />
        <KpiCard label="Puntuales" value={formatMoney(puntualesMes)} borderColor="border-t-amber-500" />
        <KpiCard
          label="Top categoría"
          value={topCategoria ? topCategoria[0] : '—'}
          subtitle={topCategoria ? formatMoney(topCategoria[1]) : 'Sin datos'}
          borderColor="border-t-purple-500"
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
          label="Categoría"
          options={CATEGORIAS_COSTE.map((c) => ({ value: c, label: c }))}
          selected={categoriaFilters}
          onChange={(v) => setParams({ categoria: v.length > 0 ? v.join(',') : null })}
        />
        <FilterSelect
          label="Tipo"
          options={filterOptions.recurrente}
          active={recurrenteFilter}
          onChange={(v) => setParams({ recurrente: v === 'Todos' ? null : v })}
        />
        <div className="min-w-[220px] flex-1">
          <SearchBar
            placeholder="Buscar en concepto, notas, cliente..."
            value={search}
            onChange={setSearch}
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><SortableHeader label="Concepto" column="concepto" currentCol={sortCol} currentDir={sortDir} onToggle={toggleSort} /></TableHead>
              <TableHead><SortableHeader label="Categoría" column="categoria" currentCol={sortCol} currentDir={sortDir} onToggle={toggleSort} /></TableHead>
              <TableHead><SortableHeader label="Empresa" column="empresaGrupoNombre" currentCol={sortCol} currentDir={sortDir} onToggle={toggleSort} /></TableHead>
              <TableHead>Asignación</TableHead>
              <TableHead className="text-right"><SortableHeader label="Importe" column="importe" currentCol={sortCol} currentDir={sortDir} onToggle={toggleSort} align="right" /></TableHead>
              <TableHead><SortableHeader label="Mes inicio" column="mes_inicio" currentCol={sortCol} currentDir={sortDir} onToggle={toggleSort} /></TableHead>
              <TableHead>Recurrencia</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                  No hay costes fijos vigentes para este mes.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((r) => {
                const deptoNombres = r.departamentoIds.map((id) => deptoMap.get(id)?.nombre).filter(Boolean) as string[]
                const personaNombres = r.personaIds.map((id) => personaMap.get(id)?.persona).filter(Boolean) as string[]
                const sinAsignar = !r.empresa_id && deptoNombres.length === 0 && personaNombres.length === 0
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm font-medium">{r.concepto}</TableCell>
                    <TableCell className="text-sm">{r.categoria}</TableCell>
                    <TableCell className="text-sm">{r.empresaGrupoNombre}</TableCell>
                    <TableCell className="text-xs">
                      {sinAsignar ? (
                        <span className="text-muted-foreground">General</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {r.empresaClienteNombre && (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                              {r.empresaClienteNombre}
                            </span>
                          )}
                          {deptoNombres.map((n) => (
                            <span key={`d-${n}`} className="rounded-full bg-purple-50 px-2 py-0.5 text-purple-700">
                              {n}
                            </span>
                          ))}
                          {personaNombres.map((n) => (
                            <span key={`p-${n}`} className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                              {n}
                            </span>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-right font-medium">{formatMoney(Number(r.importe))}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{r.mes_inicio.slice(0, 7)}</TableCell>
                    <TableCell className="text-xs">
                      {r.recurrente ? (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">
                          Recurrente {r.mes_fin ? `· hasta ${r.mes_fin.slice(0, 7)}` : ''}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">
                          Puntual
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <CosteFijoFormSheet
                        empresasGrupo={empresasGrupo}
                        departamentos={departamentos}
                        personas={personas}
                        empresas={empresas}
                        costeFijo={r}
                        cfDepartamentos={cfDepartamentos}
                        cfPersonas={cfPersonas}
                      />
                    </TableCell>
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

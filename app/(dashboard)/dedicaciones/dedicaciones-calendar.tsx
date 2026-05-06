'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTableState } from '@/hooks/use-table-state'
import { CambiarEstadoDedicacion } from '@/components/cambiar-estado-dedicacion'
import type { EstadoDedicacion } from '@/lib/schemas/dedicacion'
import { DedicacionesFormSheet } from './dedicaciones-form-sheet'
import type {
  Dedicacion,
  Persona,
  Proyecto,
  Empresa,
  OrdenTrabajo,
  CatalogoServicio,
} from '@/lib/supabase/types'

// Rango horario visible en la rejilla. Cubre el día laboral con margen.
const HORA_INICIO = 7
const HORA_FIN = 22
const HORAS_VISIBLES = HORA_FIN - HORA_INICIO + 1 // 16 filas (de 7:00 a 22:00 inclusive)
const FILA_PX = 48 // alto en píxeles de cada hora
const SNAP_MIN = 30 // hover/click se ajustan a tramos de 30 minutos

// Colores de bloque por estado de la dedicación. Coinciden con los de StatusBadge:
// Borrador=gris, Enviado=azul, Aprobado=verde, Revisar=amarillo.
const COLOR_ESTADO: Record<string, string> = {
  Borrador: 'bg-gray-100 border-l-gray-400 text-gray-900',
  Enviado: 'bg-blue-100 border-l-blue-500 text-blue-900',
  Aprobado: 'bg-emerald-100 border-l-emerald-500 text-emerald-900',
  Revisar: 'bg-amber-100 border-l-amber-500 text-amber-900',
}

type Props = {
  dedicaciones: Dedicacion[]
  personas: Persona[]
  personasVisibles: Persona[]
  proyectos: Proyecto[]
  empresas: Empresa[]
  ordenesTrabajo: OrdenTrabajo[]
  servicios: CatalogoServicio[]
  personaAutenticadaId: string | null
  esGestion: boolean
  /** Coordinador o rol superior — necesario para mostrar opciones de Aprobado→Enviado en la pill. */
  esCoordOSuperior: boolean
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// Devuelve la fecha (YYYY-MM-DD) sumando n días a la base.
function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + n)
  return date.toISOString().slice(0, 10)
}

// Lunes (ISO 8601) de la semana que contiene la fecha indicada.
function lunesDeSemana(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dow = date.getUTCDay() // 0 dom, 1 lun … 6 sab
  const diff = dow === 0 ? -6 : 1 - dow // si es domingo, retrocedemos 6 días
  date.setUTCDate(date.getUTCDate() + diff)
  return date.toISOString().slice(0, 10)
}

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// Conversión ISO 8601 fecha ↔ semana ("YYYY-W##").
// El año del ISO week es el año de su jueves, no necesariamente el año del lunes.
function dateToIsoWeek(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dayNum = (date.getUTCDay() + 6) % 7 // Mon=0, …, Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3) // jueves de esa semana
  const isoYear = date.getUTCFullYear()
  const jan1 = new Date(Date.UTC(isoYear, 0, 1))
  const jan1Dow = (jan1.getUTCDay() + 6) % 7
  const daysToFirstThursday = (4 - jan1Dow + 7) % 7
  const firstThursday = new Date(Date.UTC(isoYear, 0, 1 + daysToFirstThursday))
  const weekNum = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86400000))
  return `${isoYear}-W${String(weekNum).padStart(2, '0')}`
}

function isoWeekToMonday(weekStr: string): string {
  const m = weekStr.match(/^(\d{4})-W(\d{2})$/)
  if (!m) return ''
  const year = Number(m[1])
  const week = Number(m[2])
  // ISO 8601: la semana 1 es la que contiene el 4 de enero.
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Dow = (jan4.getUTCDay() + 6) % 7
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Dow)
  const target = new Date(week1Monday.getTime() + (week - 1) * 7 * 86400000)
  return target.toISOString().slice(0, 10)
}

function formatFechaLarga(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function formatRangoSemana(iso: string): string {
  const lunes = lunesDeSemana(iso)
  const domingo = addDaysIso(lunes, 6)
  const [yL, mL, dL] = lunes.split('-').map(Number)
  const [yD, mD, dD] = domingo.split('-').map(Number)
  const lunesDate = new Date(Date.UTC(yL, mL - 1, dL))
  const domingoDate = new Date(Date.UTC(yD, mD - 1, dD))
  const fmtDia = (date: Date) =>
    date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return `${fmtDia(lunesDate)} – ${fmtDia(domingoDate)} ${yD}`
}

// Convierte "HH:MM[:SS]" → minutos desde medianoche. Devuelve null si no es válido.
function horaInicioToMinutos(hora: string | null): number | null {
  if (!hora) return null
  const m = hora.match(/^(\d{2}):(\d{2})/)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

// "HH:MM" desde minutos. Suma exacta sin segundos.
function minutosToHora(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function DedicacionesCalendar({
  dedicaciones,
  personas,
  personasVisibles,
  proyectos,
  empresas,
  ordenesTrabajo,
  servicios,
  personaAutenticadaId,
  esGestion,
  esCoordOSuperior,
}: Props) {
  const { setParams, getParam } = useTableState({})
  const dia = getParam('dia') ?? todayIso()
  const calVista = (getParam('calVista') ?? 'semana') as 'dia' | 'semana'
  // Por defecto la semana muestra solo lun-vie. Se activan sábado y domingo
  // marcando el check "Ver findes" (URL param `findes=1`).
  const verFindes = getParam('findes') === '1'

  // Estado del prefill al hacer clic en hueco vacío. Cuando no es null, abre el form sheet controlado.
  const [prefill, setPrefill] = useState<{ fecha: string; hora_inicio: string } | null>(null)
  // Estado de la dedicación que se está editando al hacer clic en un bloque existente.
  const [editing, setEditing] = useState<Dedicacion | null>(null)

  // Reglas de edición: solo el autor puede editar, y solo en Borrador o Revisar.
  // (gestion ya no edita dedicaciones de nadie. Su única acción de "rechazo" es Enviado→Revisar.)
  function puedeEditar(d: Dedicacion): boolean {
    const esAutor = d.persona_id === personaAutenticadaId
    return esAutor && (d.estado === 'Borrador' || d.estado === 'Revisar')
  }

  // Hover ghost (un único cursor compartido por toda la rejilla, indexado por columna).
  // {colIso, minutos} = minutos desde medianoche del inicio del bloque ghost.
  const [ghost, setGhost] = useState<{ colIso: string; minutos: number } | null>(null)

  // Días visibles en la rejilla. Día = 1. Semana = 5 (lun-vie) o 7 (con findes).
  const diasVisibles = useMemo<string[]>(() => {
    if (calVista === 'dia') return [dia]
    const lunes = lunesDeSemana(dia)
    const longitud = verFindes ? 7 : 5
    return Array.from({ length: longitud }, (_, i) => addDaysIso(lunes, i))
  }, [dia, calVista, verFindes])

  // Lookup maps para enriquecer los bloques.
  const personaMap = useMemo(() => new Map(personas.map((p) => [p.id, p])), [personas])
  const proyectoMap = useMemo(() => new Map(proyectos.map((p) => [p.id, p])), [proyectos])
  const empresaMap = useMemo(() => new Map(empresas.map((e) => [e.id, e])), [empresas])
  const otMap = useMemo(() => new Map(ordenesTrabajo.map((o) => [o.id, o])), [ordenesTrabajo])
  const servicioMap = useMemo(() => new Map(servicios.map((s) => [s.id, s])), [servicios])

  // Dedicaciones agrupadas por fecha (solo las visibles en el rango). Las legacy con
  // hora_inicio NULL se renderizan como si empezaran a las 09:00.
  const dedicacionesPorDia = useMemo<Map<string, Dedicacion[]>>(() => {
    const m = new Map<string, Dedicacion[]>()
    for (const d of dedicaciones) {
      if (!diasVisibles.includes(d.fecha)) continue
      const arr = m.get(d.fecha) ?? []
      arr.push(d)
      m.set(d.fecha, arr)
    }
    return m
  }, [dedicaciones, diasVisibles])

  // Subtotales por (proyecto_id ?? 'INTERNO') + mes-año.
  // Cada bloque muestra cuántas horas hay en total ese mes para su mismo proyecto
  // (si dos bloques comparten proyecto+mes, ven la misma cifra). Para internas
  // sin proyecto, agrupamos todas como 'INTERNO'. Se calcula sobre el array que
  // recibimos (que ya viene filtrado por los filtros de la lista).
  const subtotales = useMemo(() => {
    const keyOf = (proyectoId: string | null, fechaIso: string) =>
      `${proyectoId ?? 'INTERNO'}|${fechaIso.slice(0, 7)}`
    const acc = new Map<string, number>()
    for (const d of dedicaciones) {
      const k = keyOf(d.proyecto_id, d.fecha)
      acc.set(k, (acc.get(k) ?? 0) + Number(d.horas))
    }
    return { keyOf, acc }
  }, [dedicaciones])

  function formatHorasCompacto(n: number): string {
    return n % 1 === 0 ? `${n}h` : `${n.toFixed(1)}h`
  }

  // Navegación: ±1 día o ±1 semana.
  function navegar(dir: -1 | 1) {
    const paso = calVista === 'dia' ? 1 : 7
    setParams({ dia: addDaysIso(dia, dir * paso) })
  }
  function irAHoy() {
    setParams({ dia: null })
  }

  // Cambio de vista: si pasas a "día" desde "semana", queda el día actual.
  function cambiarVista(nueva: 'dia' | 'semana') {
    setParams({ calVista: nueva === 'semana' ? null : nueva })
  }

  // ── Helpers de posición y hover ─────────────────────────────────────
  function alturaTotalPx(): number {
    return HORAS_VISIBLES * FILA_PX
  }

  function pixelsToMinutos(yPx: number): number {
    // Snap a SNAP_MIN.
    const minTotal = (yPx / FILA_PX) * 60
    const snapped = Math.round(minTotal / SNAP_MIN) * SNAP_MIN
    const clamped = Math.max(0, Math.min((HORAS_VISIBLES - 1) * 60, snapped))
    return HORA_INICIO * 60 + clamped
  }

  function onColumnaMouseMove(colIso: string, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const yPx = e.clientY - rect.top
    const minutos = pixelsToMinutos(yPx)
    setGhost({ colIso, minutos })
  }

  function onColumnaMouseLeave() {
    setGhost(null)
  }

  function onColumnaClick(colIso: string, e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const yPx = e.clientY - rect.top
    const minutos = pixelsToMinutos(yPx)
    setPrefill({ fecha: colIso, hora_inicio: minutosToHora(minutos) })
  }

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Toolbar del calendario */}
      <div className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm">
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          <button
            onClick={() => cambiarVista('dia')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              calVista === 'dia' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50'
            }`}
          >
            Día
          </button>
          <button
            onClick={() => cambiarVista('semana')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              calVista === 'semana' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50'
            }`}
          >
            Semana
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navegar(-1)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={irAHoy}
            className="rounded-md border border-border bg-white px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted/50"
          >
            Hoy
          </button>
          <span className="min-w-[200px] text-center text-sm font-medium text-foreground">
            {calVista === 'dia' ? formatFechaLarga(dia) : formatRangoSemana(dia)}
          </span>
          <button
            onClick={() => navegar(1)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {calVista === 'semana' && (
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={verFindes}
                onChange={(e) => setParams({ findes: e.target.checked ? '1' : null })}
                className="h-3.5 w-3.5 rounded border-gray-300 text-primary accent-primary"
              />
              Ver findes
            </label>
          )}
          {calVista === 'semana' ? (
            <input
              type="week"
              value={dateToIsoWeek(dia)}
              onChange={(e) => {
                const monday = isoWeekToMonday(e.target.value)
                if (monday) setParams({ dia: monday })
              }}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring"
            />
          ) : (
            <input
              type="date"
              value={dia}
              onChange={(e) => e.target.value && setParams({ dia: e.target.value })}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring"
            />
          )}
        </div>
      </div>

      {/* Rejilla */}
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <div className="flex min-w-fit">
          {/* Columna de horas */}
          <div className="w-14 shrink-0 border-r border-border">
            <div className="h-10 border-b border-border" /> {/* hueco para encabezado */}
            <div className="relative" style={{ height: alturaTotalPx() }}>
              {Array.from({ length: HORAS_VISIBLES }).map((_, i) => (
                <div
                  key={i}
                  className="border-b border-border text-right pr-2 text-[10px] text-muted-foreground"
                  style={{ height: FILA_PX }}
                >
                  {String(HORA_INICIO + i).padStart(2, '0')}:00
                </div>
              ))}
            </div>
          </div>

          {/* Columnas de día(s) */}
          {diasVisibles.map((iso) => {
            const blocks = dedicacionesPorDia.get(iso) ?? []
            const esColumnaGhost = ghost?.colIso === iso
            const ghostTopPx = esColumnaGhost
              ? ((ghost!.minutos - HORA_INICIO * 60) / 60) * FILA_PX
              : 0
            const esHoy = iso === todayIso()
            const [, mes, dd] = iso.split('-').map(Number)

            return (
              <div
                key={iso}
                className="flex-1 min-w-[120px] border-r border-border last:border-r-0"
              >
                {/* Encabezado del día */}
                <div
                  className={`h-10 border-b border-border px-2 py-1 text-center text-xs ${
                    esHoy ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  {calVista === 'semana' && (() => {
                    // Ojo: Date.UTC usa mes 0-indexado, hay que restar 1.
                    const [yy, mm, ddNum] = iso.split('-').map(Number)
                    const dow = new Date(Date.UTC(yy, mm - 1, ddNum)).getUTCDay()
                    // dow: 0=dom, 1=lun, … 6=sab → mapeamos a índice 0=lun de DIAS_SEMANA
                    const indexDia = (dow + 6) % 7
                    return (
                      <div className="text-[10px] uppercase tracking-wide">
                        {DIAS_SEMANA[indexDia]}
                      </div>
                    )
                  })()}
                  <div className="font-medium">{dd}/{String(mes).padStart(2, '0')}</div>
                </div>

                {/* Cuerpo (rejilla horaria, hover y click) */}
                <div
                  className="relative cursor-pointer"
                  style={{ height: alturaTotalPx() }}
                  onMouseMove={(e) => onColumnaMouseMove(iso, e)}
                  onMouseLeave={onColumnaMouseLeave}
                  onClick={(e) => onColumnaClick(iso, e)}
                >
                  {/* Líneas horarias */}
                  {Array.from({ length: HORAS_VISIBLES }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-b border-border/60"
                      style={{ top: i * FILA_PX, height: FILA_PX }}
                    />
                  ))}

                  {/* Ghost (1 hora a partir de la posición del cursor) */}
                  {esColumnaGhost && (
                    <div
                      className="pointer-events-none absolute left-1 right-1 rounded-md border border-dashed border-emerald-500/60 bg-emerald-500/10"
                      style={{ top: ghostTopPx, height: FILA_PX }}
                    >
                      <span className="block px-2 pt-0.5 text-[10px] text-emerald-700">
                        + Nueva — {minutosToHora(ghost!.minutos)}
                      </span>
                    </div>
                  )}

                  {/* Bloques de dedicaciones existentes */}
                  {blocks.map((d) => {
                    const minutosInicio = horaInicioToMinutos(d.hora_inicio) ?? 9 * 60 // legacy → 09:00
                    const offsetMin = minutosInicio - HORA_INICIO * 60
                    if (offsetMin < 0 || offsetMin >= HORAS_VISIBLES * 60) return null
                    const top = (offsetMin / 60) * FILA_PX
                    const height = Math.max(20, Number(d.horas) * FILA_PX)
                    const personaNombre = personaMap.get(d.persona_id)?.persona ?? '—'
                    const proyecto = d.proyecto_id ? proyectoMap.get(d.proyecto_id) : null
                    const cliente = proyecto?.empresa_id ? empresaMap.get(proyecto.empresa_id) : null
                    const ot = d.orden_trabajo_id ? otMap.get(d.orden_trabajo_id) : null
                    const servicio = ot?.servicio_id ? servicioMap.get(ot.servicio_id) : null
                    const labelCliente = cliente?.nombre_interno ?? cliente?.nombre_legal ?? 'Interno'
                    const colorClass = COLOR_ESTADO[d.estado] ?? 'bg-gray-100 border-l-gray-400 text-gray-900'

                    const editable = puedeEditar(d)
                    const cursorClass = editable ? 'cursor-pointer hover:ring-2 hover:ring-foreground/10' : 'cursor-default'
                    // Subtotal del proyecto en el mes de este bloque (si no hay proyecto, agrupa por "interno").
                    const totalProyectoMes = subtotales.acc.get(subtotales.keyOf(d.proyecto_id, d.fecha)) ?? 0
                    const labelSubtotal = `Total mes: ${formatHorasCompacto(totalProyectoMes)}`
                    const tituloTooltip = `${personaNombre} — ${labelCliente}${servicio ? ' / ' + servicio.nombre : ''} — ${Number(d.horas)}h${editable ? '' : ` · ${d.estado}: no editable`} · ${labelSubtotal}`

                    return (
                      <div
                        key={d.id}
                        onClick={(e) => {
                          // Siempre paramos la propagación para que el clic no abra "+ Nueva" en la columna.
                          e.stopPropagation()
                          if (editable) setEditing(d)
                        }}
                        // Sin overflow-hidden: dejamos que el desplegable de "Cambiar estado" se vea
                        // por fuera del bloque. El truncate de cada línea sigue cortando el texto.
                        className={`group absolute left-1 right-1 rounded-md border-l-4 px-2 py-1 text-[11px] shadow-sm ${colorClass} ${cursorClass}`}
                        style={{ top, height }}
                        title={tituloTooltip}
                      >
                        {/* Cambiar estado: pill oculta por defecto, visible al hacer hover.
                            Al abrir el desplegable se queda fija porque CambiarEstadoDedicacion
                            controla la apertura con su propio onClick.stopPropagation. */}
                        <div className="absolute right-1 top-1 z-20 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <CambiarEstadoDedicacion
                            dedicacionId={d.id}
                            estadoActual={d.estado as EstadoDedicacion}
                            esGestion={esGestion}
                            esAutor={d.persona_id === personaAutenticadaId}
                            esCoordOSuperior={esCoordOSuperior}
                          />
                        </div>

                        <div className="truncate font-semibold leading-tight pr-1">
                          {labelCliente}
                        </div>
                        <div className="truncate text-[10px] leading-tight opacity-80">
                          {servicio?.nombre ?? proyecto?.titulo ?? d.tipo}
                        </div>
                        {height >= 36 && (
                          <div className="truncate text-[10px] leading-tight opacity-70">
                            {personaNombre}
                          </div>
                        )}
                        {height >= 56 && (
                          <div className="truncate text-[10px] font-medium leading-tight opacity-90">
                            {labelSubtotal}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Form sheet controlado: crear desde un hueco vacío. */}
      {prefill && (
        <DedicacionesFormSheet
          personas={personas}
          personasVisibles={personasVisibles}
          proyectos={proyectos}
          empresas={empresas}
          ordenesTrabajo={ordenesTrabajo}
          servicios={servicios}
          prefilledStart={prefill}
          preselectedPersonaId={!esGestion ? (personaAutenticadaId ?? undefined) : undefined}
          open={true}
          onOpenChange={(o) => { if (!o) setPrefill(null) }}
        />
      )}

      {/* Form sheet controlado: editar un bloque existente. */}
      {editing && (
        <DedicacionesFormSheet
          personas={personas}
          personasVisibles={personasVisibles}
          proyectos={proyectos}
          empresas={empresas}
          ordenesTrabajo={ordenesTrabajo}
          servicios={servicios}
          dedicacion={editing}
          open={true}
          onOpenChange={(o) => { if (!o) setEditing(null) }}
        />
      )}
    </div>
  )
}

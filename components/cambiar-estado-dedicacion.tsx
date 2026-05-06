'use client'

import { useState, useRef, useEffect } from 'react'
import { Loader2, Check } from 'lucide-react'
import { cambiarEstadoDedicacion } from '@/app/(dashboard)/dedicaciones/actions'
import type { EstadoDedicacion } from '@/lib/schemas/dedicacion'
import { cn } from '@/lib/utils'

const statusStyles: Record<EstadoDedicacion, { badge: string; item: string }> = {
  Borrador: { badge: 'bg-gray-100 text-gray-600 border border-gray-400', item: 'text-gray-600' },
  Enviado: { badge: 'bg-blue-50 text-blue-700 border border-blue-400', item: 'text-blue-700' },
  Aprobado: { badge: 'bg-emerald-50 text-emerald-700 border border-emerald-400', item: 'text-emerald-700' },
  Revisar: { badge: 'bg-amber-50 text-amber-700 border border-amber-400', item: 'text-amber-700' },
}

type Props = {
  dedicacionId: string
  estadoActual: EstadoDedicacion
  esGestion: boolean
  esAutor: boolean
  esCoordOSuperior: boolean
}

type Opcion = { to: EstadoDedicacion; label: string }

// Quién puede ejecutar cada transición. Mantener sincronizado con REGLAS_TRANSICION
// del server action.
function opcionesPermitidas(
  estadoActual: EstadoDedicacion,
  esGestion: boolean,
  esAutor: boolean,
  esCoordOSuperior: boolean,
): Opcion[] {
  const r: Opcion[] = []
  if (estadoActual === 'Borrador' && esAutor) r.push({ to: 'Enviado', label: 'Enviar' })
  if (estadoActual === 'Enviado' && esGestion) {
    r.push({ to: 'Aprobado', label: 'Aprobar' })
    r.push({ to: 'Revisar', label: 'Devolver a revisar' })
  }
  if (estadoActual === 'Revisar' && esAutor) r.push({ to: 'Enviado', label: 'Enviar de nuevo' })
  if (estadoActual === 'Aprobado' && esCoordOSuperior) r.push({ to: 'Enviado', label: 'Devolver a enviado' })
  return r
}

export function CambiarEstadoDedicacion({
  dedicacionId, estadoActual, esGestion, esAutor, esCoordOSuperior,
}: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const opciones = opcionesPermitidas(estadoActual, esGestion, esAutor, esCoordOSuperior)
  const puedeInteractuar = opciones.length > 0
  const current = statusStyles[estadoActual]

  async function handleChange(destino: EstadoDedicacion, label: string) {
    setOpen(false)
    if (!confirm(`¿Confirmas "${label}" esta dedicación?`)) return
    setLoading(true)
    setError('')
    const result = await cambiarEstadoDedicacion(dedicacionId, destino)
    if (!result.success) setError(result.error ?? 'Error al cambiar el estado')
    setLoading(false)
  }

  return (
    <div className="relative" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => {
          if (!puedeInteractuar) return
          setOpen(!open)
          setError('')
        }}
        disabled={loading || !puedeInteractuar}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold transition-all',
          puedeInteractuar
            ? 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-current/20'
            : 'cursor-default',
          'disabled:opacity-60',
          current.badge,
        )}
        title={puedeInteractuar ? 'Cambiar estado' : 'Sin transiciones disponibles'}
      >
        {loading && <Loader2 className="h-3 w-3 animate-spin" />}
        {estadoActual.toUpperCase()}
      </button>

      {error && (
        <div className="absolute left-0 top-full z-50 mt-1 max-w-[220px] rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 shadow-lg">
          {error}
        </div>
      )}

      {open && puedeInteractuar && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-border bg-white py-1 shadow-lg">
          {opciones.map((o) => {
            const style = statusStyles[o.to]
            return (
              <button
                key={o.to}
                onClick={() => handleChange(o.to, o.label)}
                className={cn(
                  'flex w-full items-center justify-between px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/50',
                  style.item,
                )}
              >
                {o.label}
                <Check className="h-3.5 w-3.5 opacity-0" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

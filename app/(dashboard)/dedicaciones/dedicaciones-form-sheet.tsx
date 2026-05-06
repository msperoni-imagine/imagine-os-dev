'use client'

import { useState, useMemo, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  dedicacionSchema,
  TIPOS_DEDICACION,
  type DedicacionFormData,
  type TipoDedicacion,
  type EstadoDedicacion,
} from '@/lib/schemas/dedicacion'
import { crearDedicacion, editarDedicacion, eliminarDedicacion } from './actions'
import type {
  Dedicacion,
  Persona,
  Proyecto,
  Empresa,
  OrdenTrabajo,
  CatalogoServicio,
} from '@/lib/supabase/types'
import {
  Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Loader2, Pencil, Trash2, Copy, AlertTriangle } from 'lucide-react'
import { SearchableSelect } from '@/components/ui/searchable-select'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-destructive mt-1">{message}</p>
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// Valor sentinela para "proyecto sin cliente" (horas internas, formación, etc.).
// No se persiste: solo sirve para filtrar OTs y proyectos dentro del form.
const INTERNO = '__INTERNO__'

function mesAnioFromFecha(fecha: string): string {
  // "YYYY-MM-DD" → "YYYY-MM-01"
  return fecha.slice(0, 7) + '-01'
}

type Props = {
  /** @deprecated ya no se usa en el form (selector de persona retirado). Se mantiene para compat con call-sites antiguos. */
  personas?: Persona[]
  proyectos: Proyecto[]
  empresas: Empresa[]
  ordenesTrabajo: OrdenTrabajo[]
  servicios: CatalogoServicio[]
  /** Modo edición: pasar la dedicación existente */
  dedicacion?: Dedicacion
  /** Modo duplicar: pasar la dedicación origen. Crea una nueva con todos los datos copiados excepto la fecha. */
  duplicateFrom?: Dedicacion
  /** Pre-rellena el persona_id al crear; el server lo fuerza al usuario autenticado de todas formas. */
  preselectedPersonaId?: string
  /** Modo crear desde calendario: pre-rellena fecha y hora_inicio (típicamente 1 hora de duración por defecto). */
  prefilledStart?: { fecha: string; hora_inicio: string }
  /** @deprecated ya no se usa en el form (selector de persona retirado). */
  personasVisibles?: Persona[]
  trigger?: React.ReactElement
  onCreated?: (id: string) => void
  /** Modo controlado: si se pasan `open` + `onOpenChange`, no se renderiza el trigger. Útil para abrir desde el calendario. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function DedicacionesFormSheet({
  proyectos,
  empresas,
  ordenesTrabajo,
  servicios,
  dedicacion,
  duplicateFrom,
  preselectedPersonaId,
  prefilledStart,
  trigger,
  onCreated,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: Props) {
  const isEditMode = !!dedicacion
  const isDuplicateMode = !!duplicateFrom && !isEditMode
  const isControlled = openProp !== undefined
  const [openInternal, setOpenInternal] = useState(false)
  const open = isControlled ? openProp! : openInternal
  const setOpen = (next: boolean) => {
    if (isControlled) onOpenChangeProp?.(next)
    else setOpenInternal(next)
  }
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Cliente seleccionado (empresa_id | INTERNO | '') — no se persiste, filtra OT y proyecto
  const [clienteId, setClienteId] = useState<string>('')
  const [clienteError, setClienteError] = useState('')

  const empresaMap = useMemo(() => new Map(empresas.map((e) => [e.id, e])), [empresas])
  const proyectoMap = useMemo(() => new Map(proyectos.map((p) => [p.id, p])), [proyectos])
  const servicioMap = useMemo(() => new Map(servicios.map((s) => [s.id, s])), [servicios])

  // ── Defaults ───────────────────────────────────────────────────────
  // Si vienen prefilledStart (clic en calendario), 1h por defecto. Si no, 8h.
  const createDefaults: DedicacionFormData = {
    persona_id: preselectedPersonaId ?? '',
    orden_trabajo_id: '',
    proyecto_id: '',
    fecha: prefilledStart?.fecha ?? todayIso(),
    hora_inicio: prefilledStart?.hora_inicio ?? '',
    horas: prefilledStart ? 1 : 8,
    descripcion: '',
    tipo: 'Facturable' as TipoDedicacion,
    estado: 'Borrador' as EstadoDedicacion,
  }

  const duplicateDefaults: DedicacionFormData | null = duplicateFrom
    ? {
        persona_id: duplicateFrom.persona_id,
        orden_trabajo_id: duplicateFrom.orden_trabajo_id ?? '',
        proyecto_id: duplicateFrom.proyecto_id ?? '',
        fecha: '',
        hora_inicio: duplicateFrom.hora_inicio ?? '',
        horas: Number(duplicateFrom.horas),
        descripcion: duplicateFrom.descripcion ?? '',
        tipo: duplicateFrom.tipo as TipoDedicacion,
        estado: 'Borrador' as EstadoDedicacion,
      }
    : null

  const {
    register, handleSubmit, watch, setValue, reset, formState: { errors },
  } = useForm<DedicacionFormData>({
    resolver: zodResolver(dedicacionSchema),
    defaultValues: isEditMode
      ? {
          persona_id: dedicacion.persona_id,
          orden_trabajo_id: dedicacion.orden_trabajo_id ?? '',
          proyecto_id: dedicacion.proyecto_id ?? '',
          fecha: dedicacion.fecha,
          hora_inicio: dedicacion.hora_inicio ?? '',
          horas: Number(dedicacion.horas),
          descripcion: dedicacion.descripcion ?? '',
          tipo: dedicacion.tipo as TipoDedicacion,
          estado: dedicacion.estado as EstadoDedicacion,
        }
      : (duplicateDefaults ?? createDefaults),
  })

  const otId = watch('orden_trabajo_id')
  const proyectoId = watch('proyecto_id')
  const fecha = watch('fecha')
  const mesAnioSeleccionado = fecha ? mesAnioFromFecha(fecha) : null

  // Autocompletar proyecto cuando se selecciona OT (y limpiar al deseleccionar)
  useEffect(() => {
    if (!otId) return
    const ot = ordenesTrabajo.find((o) => o.id === otId)
    if (ot && ot.proyecto_id !== proyectoId) {
      setValue('proyecto_id', ot.proyecto_id, { shouldValidate: true })
    }
  }, [otId, ordenesTrabajo, proyectoId, setValue])

  // Inicializar / resetear el cliente al abrir el sheet.
  // En modo edit/duplicar: derivar del proyecto de la dedicación origen.
  useEffect(() => {
    if (!open) return
    const origen = dedicacion ?? duplicateFrom ?? null
    if (origen) {
      if (origen.proyecto_id) {
        const p = proyectoMap.get(origen.proyecto_id)
        setClienteId(p?.empresa_id ?? INTERNO)
      } else {
        setClienteId(INTERNO)
      }
    } else {
      setClienteId('')
    }
    setClienteError('')
    setSubmitAttempted(false)
  }, [open, dedicacion, duplicateFrom, proyectoMap])

  // ── Opciones de selects ───────────────────────────────────────────
  // (personas y personasVisibles ya no se usan en el form: una dedicación pertenece siempre
  // al usuario autenticado y el server fuerza persona_id al crear. Las props quedan opcionales
  // para compatibilidad con call-sites antiguos, pero no se renderiza ningún selector.)

  const empresaOptions = useMemo(() => {
    const activas = empresas
      .filter((e) => e.estado !== 'Baja')
      .sort((a, b) => (a.nombre_interno ?? a.nombre_legal).localeCompare(b.nombre_interno ?? b.nombre_legal))
      .map((e) => ({ value: e.id, label: e.nombre_interno ?? e.nombre_legal }))
    return [
      { value: INTERNO, label: '— Sin cliente (interno) —' },
      ...activas,
    ]
  }, [empresas])

  // Proyectos filtrados por cliente + fecha (no archivados, no cerrados antes de la fecha)
  const proyectoOptions = useMemo(() => {
    if (!clienteId) return []
    return proyectos
      .filter((p) => {
        if (p.archivado_at) return false
        if (clienteId === INTERNO) {
          if (p.empresa_id) return false
        } else if (p.empresa_id !== clienteId) {
          return false
        }
        // Filtro por fecha: descartar proyectos cerrados antes de la fecha seleccionada
        if (fecha && p.fecha_cierre && p.fecha_cierre < fecha) return false
        return true
      })
      .map((p) => ({ value: p.id, label: p.titulo }))
  }, [proyectos, clienteId, fecha])

  // OTs filtradas por cliente + mes de la fecha
  const otOptions = useMemo(() => {
    if (!clienteId || !mesAnioSeleccionado) return []
    return [...ordenesTrabajo]
      .filter((ot) => {
        if (ot.mes_anio !== mesAnioSeleccionado) return false
        const p = proyectoMap.get(ot.proyecto_id)
        if (!p) return false
        if (clienteId === INTERNO) return !p.empresa_id
        return p.empresa_id === clienteId
      })
      .sort((a, b) => b.mes_anio.localeCompare(a.mes_anio))
      .map((ot) => {
        const p = proyectoMap.get(ot.proyecto_id)
        const servicio = ot.servicio_id ? servicioMap.get(ot.servicio_id)?.nombre : null
        const servicioPart = servicio ? ` — ${servicio}` : ''
        return {
          value: ot.id,
          label: `${p?.titulo ?? '?'}${servicioPart}`,
        }
      })
  }, [ordenesTrabajo, proyectoMap, servicioMap, clienteId, mesAnioSeleccionado])

  // Handler: al cambiar cliente, resetear OT y proyecto
  function handleClienteChange(v: string) {
    setClienteId(v)
    setClienteError('')
    setValue('orden_trabajo_id', '', { shouldValidate: false })
    setValue('proyecto_id', '', { shouldValidate: false })
  }

  // ── Submit ────────────────────────────────────────────────────────
  async function onSubmit(data: DedicacionFormData) {
    setSubmitAttempted(true)
    if (!clienteId) {
      setClienteError('Selecciona un cliente')
      return
    }
    // Hora inicio requerida al crear/duplicar y al editar dedicaciones no-legacy.
    const horaInicioRequerida = !isEditMode || (dedicacion?.hora_inicio != null)
    if (horaInicioRequerida && !data.hora_inicio) {
      return // aviso visual ya se muestra junto al campo
    }
    setSubmitting(true)
    setServerError('')
    const result = isEditMode
      ? await editarDedicacion(dedicacion.id, data)
      : await crearDedicacion(data)
    if (result.success) {
      if (!isEditMode) {
        reset(createDefaults)
        if (result.id) onCreated?.(result.id)
      }
      setOpen(false)
    } else {
      setServerError(result.error ?? 'Error desconocido')
    }
    setSubmitting(false)
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    const result = await eliminarDedicacion(dedicacion!.id)
    if (result.success) handleOpenChange(false)
    else setServerError(result.error ?? 'Error al eliminar')
    setDeleting(false)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      if (!isEditMode) reset(duplicateDefaults ?? createDefaults)
      setServerError('')
      setConfirmDelete(false)
      setSubmitAttempted(false)
    }
  }

  const defaultTrigger = isEditMode ? (
    <button
      type="button"
      className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
      title="Editar dedicación"
    >
      <Pencil className="h-3.5 w-3.5" />
    </button>
  ) : isDuplicateMode ? (
    <button
      type="button"
      className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
      title="Duplicar dedicación"
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  ) : (
    <Button size="default" className="gap-1.5 shrink-0">
      <Plus className="h-4 w-4" />
      Nueva dedicación
    </Button>
  )

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {!isControlled && <SheetTrigger render={trigger ?? defaultTrigger} />}

      <SheetContent side="right" className="w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {isEditMode ? 'Editar dedicación' : isDuplicateMode ? 'Duplicar dedicación' : 'Nueva dedicación'}
          </SheetTitle>
          <SheetDescription>
            {isEditMode
              ? 'Modifica los datos de esta dedicación.'
              : isDuplicateMode
                ? 'Se han copiado los datos de la dedicación origen. Configura la fecha antes de guardar.'
                : 'Registra horas trabajadas por una persona en un día concreto.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit, () => setSubmitAttempted(true))} className="space-y-5 px-6 py-4">

          {/* Persona: ya no se muestra. Una dedicación pertenece siempre al usuario que la crea;
              el servidor fuerza persona_id = usuario autenticado, así que el selector sería redundante. */}

          {/* Cliente (filtra OTs y proyectos; no se persiste) */}
          <div className="space-y-1.5">
            <Label>Cliente *</Label>
            <SearchableSelect
              options={empresaOptions}
              placeholder="Seleccionar cliente..."
              value={clienteId}
              onChange={handleClienteChange}
              error={!!clienteError}
            />
            <FieldError message={clienteError} />
            <p className="text-[11px] text-muted-foreground">
              Escoge &quot;— Sin cliente (interno) —&quot; para horas internas o de formación.
            </p>
          </div>

          {/* Fecha | Hora inicio | Horas */}
          {(() => {
            const fechaActual = watch('fecha')
            const horaInicioActual = watch('hora_inicio')
            // Hora inicio es obligatoria al crear/duplicar. Al editar, solo si la dedicación
            // ya tenía una hora_inicio (las legacy con NULL pueden quedarse vacías).
            const horaInicioRequerida = !isEditMode || (dedicacion?.hora_inicio != null)

            const fechaVacia = !fechaActual
            const fechaRojo = fechaVacia && (submitAttempted || !!errors.fecha)
            const fechaAmarillo = fechaVacia && !fechaRojo

            const horaVacia = !horaInicioActual
            const horaRojo = horaInicioRequerida && horaVacia && (submitAttempted || !!errors.hora_inicio)
            const horaAmarillo = horaInicioRequerida && horaVacia && !horaRojo

            const inputBase = 'h-8 w-full rounded-lg border px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'
            const inputNormal = `${inputBase} border-input bg-transparent aria-invalid:border-destructive`
            const inputAmarillo = `${inputBase} border-amber-400 bg-amber-50/60`

            return (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fecha">Fecha *</Label>
                  <input
                    id="fecha"
                    type="date"
                    max={todayIso()}
                    aria-invalid={fechaRojo}
                    {...register('fecha', {
                      // Al cambiar la fecha, limpiar la OT porque el filtro de mes cambia.
                      // No tocamos proyecto: puede seguir siendo válido aunque cambie el mes.
                      onChange: () => setValue('orden_trabajo_id', '', { shouldValidate: false }),
                    })}
                    className={fechaAmarillo ? inputAmarillo : inputNormal}
                  />
                  {fechaAmarillo ? (
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-amber-700">
                      <AlertTriangle className="h-3 w-3" />
                      Configura la fecha.
                    </p>
                  ) : (
                    <FieldError message={errors.fecha?.message} />
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="hora_inicio">
                    Hora inicio {horaInicioRequerida && '*'}
                  </Label>
                  <input
                    id="hora_inicio"
                    type="time"
                    aria-invalid={horaRojo}
                    {...register('hora_inicio')}
                    className={horaAmarillo ? inputAmarillo : inputNormal}
                  />
                  {horaAmarillo ? (
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-amber-700">
                      <AlertTriangle className="h-3 w-3" />
                      Configura la hora.
                    </p>
                  ) : (
                    <FieldError message={errors.hora_inicio?.message} />
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="horas">Horas *</Label>
                  <Input
                    id="horas"
                    type="number"
                    min={0.25}
                    max={24}
                    step={0.25}
                    {...register('horas', { valueAsNumber: true })}
                    aria-invalid={!!errors.horas}
                  />
                  <FieldError message={errors.horas?.message} />
                </div>
              </div>
            )
          })()}

          {/* Tipo */}
          <div className="space-y-1.5">
            <Label>Tipo *</Label>
            <select
              {...register('tipo')}
              aria-invalid={!!errors.tipo}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
            >
              {TIPOS_DEDICACION.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <FieldError message={errors.tipo?.message} />
          </div>

          {/* Orden de trabajo */}
          <div className="space-y-1.5">
            <Label>
              Orden de trabajo <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <SearchableSelect
              options={otOptions}
              placeholder={
                !clienteId ? 'Elige cliente primero'
                : otOptions.length === 0 ? 'No hay OTs del cliente en este mes'
                : 'Sin OT (horas internas)'
              }
              value={watch('orden_trabajo_id')}
              onChange={(v) => {
                setValue('orden_trabajo_id', v, { shouldValidate: true })
                // Si se deselecciona la OT, no tocamos el proyecto (el usuario lo elegirá)
              }}
              disabled={!clienteId}
            />
            <p className="text-[11px] text-muted-foreground">
              Filtradas por cliente + mes de la fecha. Al seleccionar una OT, el proyecto se rellena automáticamente.
            </p>
          </div>

          {/* Proyecto */}
          <div className="space-y-1.5">
            <Label>
              Proyecto {!otId && <span className="text-muted-foreground font-normal">(opcional)</span>}
            </Label>
            <SearchableSelect
              options={proyectoOptions}
              placeholder={
                otId ? 'Auto desde la OT'
                : !clienteId ? 'Elige cliente primero'
                : proyectoOptions.length === 0 ? 'Sin proyectos activos para cliente+fecha'
                : 'Selecciona proyecto o déjalo vacío'
              }
              value={watch('proyecto_id')}
              onChange={(v) => setValue('proyecto_id', v, { shouldValidate: true })}
              disabled={!!otId || !clienteId}
            />
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <Label htmlFor="descripcion">
              Descripción <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Textarea
              id="descripcion"
              placeholder="Qué se hizo en estas horas..."
              {...register('descripcion')}
            />
          </div>

          {serverError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
              <p className="text-sm text-destructive">{serverError}</p>
            </div>
          )}

          <SheetFooter className="flex gap-2 pt-2">
            {isEditMode && (
              <Button
                type="button"
                variant={confirmDelete ? 'destructive' : 'outline'}
                size="sm"
                onClick={handleDelete}
                disabled={deleting || submitting}
                className="gap-1.5 mr-auto"
              >
                {deleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                {confirmDelete ? '¿Eliminar dedicación?' : 'Eliminar'}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting || deleting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || deleting} className="gap-1.5">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Guardando...' : isEditMode ? 'Guardar cambios' : 'Crear dedicación'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

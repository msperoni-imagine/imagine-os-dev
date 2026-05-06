'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  oportunidadSchema, ETAPAS_OPORTUNIDAD,
  type OportunidadFormData, type EtapaOportunidad,
} from '@/lib/schemas/oportunidad'
import {
  crearOportunidad, actualizarOportunidad, eliminarOportunidad,
  crearProyectoDesdeOportunidad,
} from './actions'
import type {
  Oportunidad, Empresa, EmpresaGrupo, ContactoEmpresa, Persona, Proyecto,
} from '@/lib/supabase/types'
import {
  Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Loader2, Pencil, Trash2, Sparkles } from 'lucide-react'
import { SearchableSelect } from '@/components/ui/searchable-select'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-destructive mt-1">{message}</p>
}

type Props = {
  empresas: Empresa[]
  empresasGrupo: EmpresaGrupo[]
  contactos: ContactoEmpresa[]
  personas: Persona[]
  proyectos: Proyecto[]
  /** Modo edición */
  oportunidad?: Oportunidad
  /** Pre-rellenar empresa al abrir desde detalle de empresa */
  preselectedEmpresaId?: string
  trigger?: React.ReactElement
  onCreated?: (id: string) => void
}

export function OportunidadFormSheet({
  empresas, empresasGrupo, contactos, personas, proyectos,
  oportunidad, preselectedEmpresaId, trigger, onCreated,
}: Props) {
  const isEditMode = !!oportunidad
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [creatingProject, setCreatingProject] = useState(false)

  const createDefaults: OportunidadFormData = {
    empresa_id: preselectedEmpresaId ?? '',
    empresa_grupo_id: '',
    titulo: '',
    descripcion: '',
    valor_estimado: null,
    probabilidad_pct: null,
    etapa: 'Prospección' as EtapaOportunidad,
    fecha_cierre_estimada: '',
    fecha_cierre_real: '',
    motivo_perdida: '',
    contacto_id: '',
    responsable_id: '',
    proyecto_id: '',
    notas: '',
  }

  const {
    register, handleSubmit, watch, setValue, reset, formState: { errors },
  } = useForm<OportunidadFormData>({
    resolver: zodResolver(oportunidadSchema),
    defaultValues: isEditMode ? {
      empresa_id: oportunidad.empresa_id,
      empresa_grupo_id: oportunidad.empresa_grupo_id,
      titulo: oportunidad.titulo,
      descripcion: oportunidad.descripcion ?? '',
      valor_estimado: oportunidad.valor_estimado === null ? null : Number(oportunidad.valor_estimado),
      probabilidad_pct: oportunidad.probabilidad_pct,
      etapa: oportunidad.etapa as EtapaOportunidad,
      fecha_cierre_estimada: oportunidad.fecha_cierre_estimada ?? '',
      fecha_cierre_real: oportunidad.fecha_cierre_real ?? '',
      motivo_perdida: oportunidad.motivo_perdida ?? '',
      contacto_id: oportunidad.contacto_id ?? '',
      responsable_id: oportunidad.responsable_id,
      proyecto_id: oportunidad.proyecto_id ?? '',
      notas: oportunidad.notas ?? '',
    } : createDefaults,
  })

  const empresaSel = watch('empresa_id')
  const egSel = watch('empresa_grupo_id')
  const etapaSel = watch('etapa')

  const empresaOptions = useMemo(
    () => empresas
      .filter((e) => e.estado !== 'Baja')
      .map((e) => ({ value: e.id, label: e.nombre_interno ?? e.nombre_legal }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [empresas],
  )
  const egOptions = useMemo(
    () => empresasGrupo.map((eg) => ({ value: eg.id, label: eg.nombre })),
    [empresasGrupo],
  )

  // Contactos filtrados por empresa seleccionada (cliente)
  const contactosOptions = useMemo(
    () => contactos
      .filter((c) => c.activo && c.empresa_id === empresaSel)
      .map((c) => ({
        value: c.id,
        label: c.apellidos ? `${c.nombre} ${c.apellidos}` : c.nombre,
      })),
    [contactos, empresaSel],
  )

  // Responsables: personas activas de la EG seleccionada
  const responsablesOptions = useMemo(
    () => personas
      .filter((p) => p.activo && (!egSel || p.empresa_grupo_id === egSel))
      .map((p) => ({ value: p.id, label: p.persona }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [personas, egSel],
  )

  // Proyectos para vincular (cuando ganada): proyectos del cliente seleccionado
  const proyectoOptions = useMemo(
    () => proyectos
      .filter((p) => !p.deleted_at && (!empresaSel || p.empresa_id === empresaSel))
      .map((p) => ({ value: p.id, label: p.titulo })),
    [proyectos, empresaSel],
  )

  async function onSubmit(data: OportunidadFormData) {
    setSubmitting(true)
    setServerError('')
    const result = isEditMode
      ? await actualizarOportunidad(oportunidad.id, data)
      : await crearOportunidad(data)
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
    const result = await eliminarOportunidad(oportunidad!.id)
    if (result.success) handleOpenChange(false)
    else setServerError(result.error ?? 'Error al eliminar')
    setDeleting(false)
  }

  async function handleCrearProyecto() {
    if (!oportunidad) return
    if (!confirm('¿Crear un proyecto nuevo a partir de esta oportunidad?')) return
    setCreatingProject(true)
    setServerError('')
    const result = await crearProyectoDesdeOportunidad(oportunidad.id)
    if (!result.success) setServerError(result.error ?? 'Error al crear proyecto')
    else handleOpenChange(false)
    setCreatingProject(false)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      if (!isEditMode) reset(createDefaults)
      setServerError('')
      setConfirmDelete(false)
    }
  }

  const defaultTrigger = isEditMode ? (
    <button
      type="button"
      className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
      title="Editar oportunidad"
    >
      <Pencil className="h-3.5 w-3.5" />
    </button>
  ) : (
    <Button size="default" className="gap-1.5 shrink-0">
      <Plus className="h-4 w-4" />
      Nueva oportunidad
    </Button>
  )

  // Mostrar opciones avanzadas solo según etapa
  const esCerradaPerdida = etapaSel === 'Cerrada perdida'
  const esCerradaGanada = etapaSel === 'Cerrada ganada'

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger render={trigger ?? defaultTrigger} />

      <SheetContent side="right" className="w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditMode ? 'Editar oportunidad' : 'Nueva oportunidad'}</SheetTitle>
          <SheetDescription>
            {isEditMode
              ? 'Modifica los datos de esta oportunidad comercial.'
              : 'Registra una oportunidad comercial con un cliente.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 px-6 py-4">

          {/* Cliente + EG */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cliente *</Label>
              <SearchableSelect
                options={empresaOptions}
                placeholder="Seleccionar..."
                value={watch('empresa_id')}
                onChange={(v) => {
                  setValue('empresa_id', v, { shouldValidate: true })
                  // al cambiar empresa, reset contacto (otra empresa = otros contactos)
                  setValue('contacto_id', '')
                  setValue('proyecto_id', '')
                }}
                error={!!errors.empresa_id}
              />
              <FieldError message={errors.empresa_id?.message} />
            </div>
            <div className="space-y-1.5">
              <Label>Empresa del holding *</Label>
              <SearchableSelect
                options={egOptions}
                placeholder="Seleccionar..."
                value={watch('empresa_grupo_id')}
                onChange={(v) => {
                  setValue('empresa_grupo_id', v, { shouldValidate: true })
                  setValue('responsable_id', '')
                }}
                error={!!errors.empresa_grupo_id}
              />
              <FieldError message={errors.empresa_grupo_id?.message} />
            </div>
          </div>

          {/* Título */}
          <div className="space-y-1.5">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              placeholder="Ej. Rediseño web e-commerce"
              aria-invalid={!!errors.titulo}
              {...register('titulo')}
            />
            <FieldError message={errors.titulo?.message} />
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <Label htmlFor="descripcion">
              Descripción <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Textarea id="descripcion" placeholder="Detalles del alcance..." {...register('descripcion')} />
          </div>

          {/* Valor + Probabilidad */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="valor_estimado">Valor estimado (€)</Label>
              <Input
                id="valor_estimado"
                type="number"
                min={0}
                step={100}
                placeholder="0"
                {...register('valor_estimado', { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="probabilidad_pct">Probabilidad (%)</Label>
              <Input
                id="probabilidad_pct"
                type="number"
                min={0}
                max={100}
                step={5}
                placeholder="0"
                {...register('probabilidad_pct', { valueAsNumber: true })}
              />
            </div>
          </div>

          {/* Etapa */}
          <div className="space-y-1.5">
            <Label>Etapa *</Label>
            <select
              {...register('etapa')}
              aria-invalid={!!errors.etapa}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
            >
              {ETAPAS_OPORTUNIDAD.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            <FieldError message={errors.etapa?.message} />
          </div>

          {/* Fecha cierre estimada */}
          <div className="space-y-1.5">
            <Label htmlFor="fecha_cierre_estimada">Fecha de cierre estimada</Label>
            <input
              id="fecha_cierre_estimada"
              type="date"
              {...register('fecha_cierre_estimada')}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          {/* Cerrada perdida → motivo obligatorio */}
          {esCerradaPerdida && (
            <div className="space-y-1.5 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
              <Label htmlFor="motivo_perdida">Motivo de la pérdida *</Label>
              <Textarea
                id="motivo_perdida"
                placeholder="Por qué se perdió esta oportunidad"
                aria-invalid={!!errors.motivo_perdida}
                {...register('motivo_perdida')}
              />
              <FieldError message={errors.motivo_perdida?.message} />
            </div>
          )}

          {/* Cerrada ganada → fecha real + vinculación a proyecto */}
          {esCerradaGanada && (
            <div className="space-y-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="fecha_cierre_real">Fecha de cierre real</Label>
                <input
                  id="fecha_cierre_real"
                  type="date"
                  {...register('fecha_cierre_real')}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Vincular a proyecto existente <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <SearchableSelect
                  options={proyectoOptions}
                  placeholder="Selecciona un proyecto del cliente"
                  value={watch('proyecto_id')}
                  onChange={(v) => setValue('proyecto_id', v, { shouldValidate: true })}
                />
                {isEditMode && !oportunidad.proyecto_id && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 mt-1"
                    onClick={handleCrearProyecto}
                    disabled={creatingProject || submitting}
                  >
                    {creatingProject ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    Crear proyecto desde esta oportunidad
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Contacto + Responsable */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>
                Contacto <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <SearchableSelect
                options={contactosOptions}
                placeholder={empresaSel ? 'Sin contacto' : 'Elige cliente primero'}
                value={watch('contacto_id')}
                onChange={(v) => setValue('contacto_id', v, { shouldValidate: true })}
                disabled={!empresaSel}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Responsable *</Label>
              <SearchableSelect
                options={responsablesOptions}
                placeholder={egSel ? 'Seleccionar...' : 'Elige empresa holding'}
                value={watch('responsable_id')}
                onChange={(v) => setValue('responsable_id', v, { shouldValidate: true })}
                disabled={!egSel}
                error={!!errors.responsable_id}
              />
              <FieldError message={errors.responsable_id?.message} />
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label htmlFor="notas">
              Notas <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Textarea id="notas" placeholder="Histórico, próximos pasos..." {...register('notas')} />
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
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {confirmDelete ? '¿Eliminar oportunidad?' : 'Eliminar'}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting || deleting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || deleting} className="gap-1.5">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Guardando...' : isEditMode ? 'Guardar cambios' : 'Crear oportunidad'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  costeFijoSchema, CATEGORIAS_COSTE,
  type CosteFijoFormData, type CategoriaCoste,
} from '@/lib/schemas/coste-fijo'
import { crearCosteFijo, actualizarCosteFijo, eliminarCosteFijo } from './actions'
import type {
  CosteFijo, CosteFijoDepartamento, CosteFijoPersona,
  EmpresaGrupo, Departamento, Persona, Empresa,
} from '@/lib/supabase/types'
import {
  Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Loader2, Pencil, Trash2 } from 'lucide-react'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { MultiSelectFilter } from '@/components/multi-select-filter'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-destructive mt-1">{message}</p>
}

function currentMonthIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

type Props = {
  empresasGrupo: EmpresaGrupo[]
  departamentos: Departamento[]
  personas: Persona[]
  empresas: Empresa[]
  /** Modo edición */
  costeFijo?: CosteFijo
  /** Relaciones N:M existentes (filtradas por costeFijo.id en modo edición) */
  cfDepartamentos?: CosteFijoDepartamento[]
  cfPersonas?: CosteFijoPersona[]
  trigger?: React.ReactElement
}

export function CosteFijoFormSheet({
  empresasGrupo, departamentos, personas, empresas,
  costeFijo, cfDepartamentos = [], cfPersonas = [], trigger,
}: Props) {
  const isEditMode = !!costeFijo
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // IDs iniciales de relaciones (modo edición)
  const initialDeptoIds = useMemo(
    () => isEditMode ? cfDepartamentos.filter((r) => r.coste_fijo_id === costeFijo.id).map((r) => r.departamento_id) : [],
    [isEditMode, cfDepartamentos, costeFijo],
  )
  const initialPersonaIds = useMemo(
    () => isEditMode ? cfPersonas.filter((r) => r.coste_fijo_id === costeFijo.id).map((r) => r.persona_id) : [],
    [isEditMode, cfPersonas, costeFijo],
  )

  const createDefaults: CosteFijoFormData = {
    empresa_grupo_id: '',
    concepto: '',
    categoria: 'Otros' as CategoriaCoste,
    mes_inicio: currentMonthIso(),
    mes_fin: '',
    importe: 0,
    recurrente: false,
    empresa_id: '',
    departamento_ids: [],
    persona_ids: [],
    notas: '',
  }

  const {
    register, handleSubmit, watch, setValue, reset, formState: { errors },
  } = useForm<CosteFijoFormData>({
    resolver: zodResolver(costeFijoSchema),
    defaultValues: isEditMode ? {
      empresa_grupo_id: costeFijo.empresa_grupo_id,
      concepto: costeFijo.concepto,
      categoria: costeFijo.categoria as CategoriaCoste,
      mes_inicio: costeFijo.mes_inicio,
      mes_fin: costeFijo.mes_fin ?? '',
      importe: Number(costeFijo.importe),
      recurrente: costeFijo.recurrente,
      empresa_id: costeFijo.empresa_id ?? '',
      departamento_ids: initialDeptoIds,
      persona_ids: initialPersonaIds,
      notas: costeFijo.notas ?? '',
    } : createDefaults,
  })

  // Resincronizar IDs de N:M al abrir (necesario porque defaultValues solo se aplica una vez)
  useEffect(() => {
    if (!open || !isEditMode) return
    setValue('departamento_ids', initialDeptoIds)
    setValue('persona_ids', initialPersonaIds)
  }, [open, isEditMode, initialDeptoIds, initialPersonaIds, setValue])

  const recurrente = watch('recurrente')
  const mesInicioForm = watch('mes_inicio')
  const empresaGrupoSel = watch('empresa_grupo_id')

  const empresaGrupoOptions = useMemo(
    () => empresasGrupo.map((eg) => ({ value: eg.id, label: eg.nombre })),
    [empresasGrupo],
  )
  const empresaOptions = useMemo(
    () => empresas
      .filter((e) => e.estado !== 'Baja')
      .map((e) => ({ value: e.id, label: e.nombre_interno ?? e.nombre_legal }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [empresas],
  )

  // Departamentos y personas filtrados por la EG seleccionada.
  // Sin EG seleccionada → listas vacías (forzamos a elegir EG primero).
  const departamentoOptions = useMemo(
    () => departamentos
      .filter((d) => empresaGrupoSel && d.empresa_grupo_id === empresaGrupoSel)
      .map((d) => ({ value: d.id, label: d.nombre })),
    [departamentos, empresaGrupoSel],
  )
  const personasOptions = useMemo(
    () => personas
      .filter((p) => p.activo && empresaGrupoSel && p.empresa_grupo_id === empresaGrupoSel)
      .map((p) => ({ value: p.id, label: p.persona }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [personas, empresaGrupoSel],
  )

  // Al cambiar la EG seleccionada, depurar las selecciones N:M que ya no son válidas.
  // No se aplica en el primer render del modo edit (los initial son consistentes).
  useEffect(() => {
    if (!open) return
    const validDeptoIds = new Set(
      departamentos.filter((d) => d.empresa_grupo_id === empresaGrupoSel).map((d) => d.id),
    )
    const validPersonaIds = new Set(
      personas.filter((p) => p.empresa_grupo_id === empresaGrupoSel).map((p) => p.id),
    )
    const currentDeptos = (watch('departamento_ids') ?? []).filter((id) => validDeptoIds.has(id))
    const currentPersonas = (watch('persona_ids') ?? []).filter((id) => validPersonaIds.has(id))
    if (currentDeptos.length !== (watch('departamento_ids') ?? []).length) {
      setValue('departamento_ids', currentDeptos)
    }
    if (currentPersonas.length !== (watch('persona_ids') ?? []).length) {
      setValue('persona_ids', currentPersonas)
    }
  }, [empresaGrupoSel, open, departamentos, personas, setValue, watch])

  async function onSubmit(data: CosteFijoFormData) {
    setSubmitting(true)
    setServerError('')
    const result = isEditMode
      ? await actualizarCosteFijo(costeFijo.id, data)
      : await crearCosteFijo(data)
    if (result.success) {
      if (!isEditMode) reset(createDefaults)
      setOpen(false)
    } else {
      setServerError(result.error ?? 'Error desconocido')
    }
    setSubmitting(false)
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    const result = await eliminarCosteFijo(costeFijo!.id)
    if (result.success) handleOpenChange(false)
    else setServerError(result.error ?? 'Error al eliminar')
    setDeleting(false)
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
      title="Editar coste fijo"
    >
      <Pencil className="h-3.5 w-3.5" />
    </button>
  ) : (
    <Button size="default" className="gap-1.5 shrink-0">
      <Plus className="h-4 w-4" />
      Nuevo coste fijo
    </Button>
  )

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger render={trigger ?? defaultTrigger} />

      <SheetContent side="right" className="w-[520px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditMode ? 'Editar coste fijo' : 'Nuevo coste fijo'}</SheetTitle>
          <SheetDescription>
            {isEditMode
              ? 'Modifica los datos de este coste fijo.'
              : 'Registra un coste mensual: alquiler, software, móviles, freelancers...'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 px-6 py-4">

          {/* Empresa grupo */}
          <div className="space-y-1.5">
            <Label>Empresa del holding *</Label>
            <SearchableSelect
              options={empresaGrupoOptions}
              placeholder="Seleccionar empresa..."
              value={watch('empresa_grupo_id')}
              onChange={(v) => setValue('empresa_grupo_id', v, { shouldValidate: true })}
              error={!!errors.empresa_grupo_id}
            />
            <FieldError message={errors.empresa_grupo_id?.message} />
          </div>

          {/* Concepto + Categoría */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="concepto">Concepto *</Label>
              <Input
                id="concepto"
                placeholder="Ej. Alquiler oficina, Adobe CC..."
                aria-invalid={!!errors.concepto}
                {...register('concepto')}
              />
              <FieldError message={errors.concepto?.message} />
            </div>
            <div className="space-y-1.5">
              <Label>Categoría *</Label>
              <select
                {...register('categoria')}
                aria-invalid={!!errors.categoria}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
              >
                {CATEGORIAS_COSTE.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <FieldError message={errors.categoria?.message} />
            </div>
          </div>

          {/* Importe + Mes inicio */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="importe">Importe mensual (€) *</Label>
              <Input
                id="importe"
                type="number"
                min={0}
                step={0.01}
                {...register('importe', { valueAsNumber: true })}
                aria-invalid={!!errors.importe}
              />
              <FieldError message={errors.importe?.message} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mes_inicio">Mes inicio *</Label>
              <input
                id="mes_inicio"
                type="month"
                aria-invalid={!!errors.mes_inicio}
                value={mesInicioForm ? mesInicioForm.substring(0, 7) : ''}
                onChange={(e) => {
                  const v = e.target.value
                  setValue('mes_inicio', v ? `${v}-01` : '', { shouldValidate: true })
                }}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
              />
              <FieldError message={errors.mes_inicio?.message} />
            </div>
          </div>

          {/* Recurrente + Mes fin */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                {...register('recurrente')}
                className="h-4 w-4 rounded border-gray-300 text-primary accent-primary"
              />
              Coste recurrente (se aplica también a meses posteriores)
            </label>
            {recurrente && (
              <div className="pt-2 space-y-1.5">
                <Label htmlFor="mes_fin">
                  Mes fin <span className="text-muted-foreground font-normal">(vacío = sin fin)</span>
                </Label>
                <input
                  id="mes_fin"
                  type="month"
                  aria-invalid={!!errors.mes_fin}
                  value={watch('mes_fin') ? watch('mes_fin').substring(0, 7) : ''}
                  onChange={(e) => {
                    const v = e.target.value
                    setValue('mes_fin', v ? `${v}-01` : '', { shouldValidate: true })
                  }}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
                />
                <FieldError message={errors.mes_fin?.message} />
              </div>
            )}
          </div>

          {/* Empresa cliente */}
          <div className="space-y-1.5">
            <Label>
              Empresa cliente <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <SearchableSelect
              options={empresaOptions}
              placeholder="Sin asignar a un cliente"
              value={watch('empresa_id')}
              onChange={(v) => setValue('empresa_id', v, { shouldValidate: true })}
            />
            <p className="text-[11px] text-muted-foreground">
              Por ejemplo: freelancer dedicado a un cliente, software comprado para un cliente.
            </p>
          </div>

          {/* Departamentos (multi) */}
          <div className="space-y-1.5">
            <Label>
              Departamentos <span className="text-muted-foreground font-normal">(opcional, varios)</span>
            </Label>
            <MultiSelectFilter
              label="Departamentos"
              options={departamentoOptions}
              selected={watch('departamento_ids') ?? []}
              onChange={(v) => setValue('departamento_ids', v, { shouldValidate: true })}
              searchable
            />
            {!empresaGrupoSel && (
              <p className="text-[11px] text-muted-foreground">Elige primero la empresa del holding.</p>
            )}
          </div>

          {/* Personas (multi) */}
          <div className="space-y-1.5">
            <Label>
              Personas <span className="text-muted-foreground font-normal">(opcional, varias)</span>
            </Label>
            <MultiSelectFilter
              label="Personas"
              options={personasOptions}
              selected={watch('persona_ids') ?? []}
              onChange={(v) => setValue('persona_ids', v, { shouldValidate: true })}
              searchable
            />
            {!empresaGrupoSel && (
              <p className="text-[11px] text-muted-foreground">Elige primero la empresa del holding.</p>
            )}
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label htmlFor="notas">Notas</Label>
            <Textarea id="notas" placeholder="Detalles, periodo de validez, proveedor..." {...register('notas')} />
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
                {confirmDelete ? '¿Eliminar coste fijo?' : 'Eliminar'}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={submitting || deleting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || deleting} className="gap-1.5">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Guardando...' : isEditMode ? 'Guardar cambios' : 'Crear coste fijo'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

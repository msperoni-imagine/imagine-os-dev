import { z } from 'zod'

export const TIPOS_DEDICACION = ['Facturable', 'No facturable', 'Interno', 'Formación'] as const
export const ESTADOS_DEDICACION = ['Borrador', 'Enviado', 'Aprobado', 'Revisar'] as const

export type TipoDedicacion = typeof TIPOS_DEDICACION[number]
export type EstadoDedicacion = typeof ESTADOS_DEDICACION[number]

export const dedicacionSchema = z.object({
  // persona_id es informativo: el server lo fuerza al usuario autenticado al crear
  // y lo ignora al editar. Por eso no lo validamos como obligatorio aquí.
  persona_id: z.string(),
  // Opcionales: permitimos string vacío y lo convertimos a null en el server action.
  // La autoconsistencia (si hay OT, el proyecto debe ser el de la OT) se valida en el server action
  // porque requiere consultar la DB.
  orden_trabajo_id: z.string(),
  proyecto_id: z.string(),
  fecha: z.string()
    .min(1, 'Selecciona una fecha')
    .refine((v) => v <= new Date().toISOString().slice(0, 10), 'La fecha no puede ser futura'),
  // Formato HH:MM. Vacío permitido para editar dedicaciones legacy (anteriores a la columna).
  // En crear: el server action exige hora_inicio no vacía.
  hora_inicio: z.string()
    .refine((v) => v === '' || /^\d{2}:\d{2}$/.test(v), 'Formato HH:MM (ej. 09:30)'),
  horas: z.number()
    .min(0.01, 'Las horas deben ser mayores que 0')
    .max(24, 'Las horas no pueden superar 24'),
  descripcion: z.string(),
  tipo: z.enum(TIPOS_DEDICACION, { message: 'Selecciona un tipo' }),
  // El workflow de estados tiene acción propia. Al crear se envía 'Borrador'.
  estado: z.enum(ESTADOS_DEDICACION, { message: 'Selecciona un estado' }),
})

export type DedicacionFormData = z.infer<typeof dedicacionSchema>

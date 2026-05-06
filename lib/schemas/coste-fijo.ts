import { z } from 'zod'

export const CATEGORIAS_COSTE = [
  'Inmueble', 'Suministros', 'Comida', 'Software', 'Equipamiento',
  'Viajes', 'Formación', 'Salario', 'Externo', 'Otros',
] as const

export type CategoriaCoste = typeof CATEGORIAS_COSTE[number]

export const costeFijoSchema = z.object({
  empresa_grupo_id: z.string().min(1, 'Selecciona una empresa del holding'),
  concepto: z.string().min(1, 'Indica el concepto'),
  categoria: z.enum(CATEGORIAS_COSTE, { message: 'Selecciona una categoría' }),
  mes_inicio: z.string().min(1, 'Selecciona el mes'),  // YYYY-MM-01
  importe: z.number().min(0, 'El importe no puede ser negativo'),
  recurrente: z.boolean(),
  // Vacío permitido; el server lo convierte a null. Solo se persiste si recurrente=true.
  mes_fin: z.string(),
  // Vacío = sin asignar a empresa cliente.
  empresa_id: z.string(),
  // N:M — arrays de UUIDs. La acción reconcilia las tablas intermedias.
  departamento_ids: z.array(z.string()),
  persona_ids: z.array(z.string()),
  notas: z.string(),
}).refine(
  (data) => !data.recurrente || !data.mes_fin || data.mes_fin >= data.mes_inicio,
  { path: ['mes_fin'], message: 'mes_fin debe ser igual o posterior a mes_inicio' },
)

export type CosteFijoFormData = z.infer<typeof costeFijoSchema>

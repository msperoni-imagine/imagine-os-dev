import { z } from 'zod'

export const ETAPAS_OPORTUNIDAD = [
  'Prospección', 'Propuesta enviada', 'Negociación', 'Verbal',
  'Cerrada ganada', 'Cerrada perdida',
] as const

export type EtapaOportunidad = typeof ETAPAS_OPORTUNIDAD[number]

export const oportunidadSchema = z.object({
  empresa_id: z.string().min(1, 'Selecciona una empresa cliente'),
  empresa_grupo_id: z.string().min(1, 'Selecciona la empresa del holding'),
  titulo: z.string().min(1, 'Indica el título de la oportunidad'),
  descripcion: z.string(),
  // Permitimos NaN/null para inputs vacíos y los normalizamos a null en el server.
  valor_estimado: z.union([
    z.number().min(0, 'El valor no puede ser negativo'),
    z.nan(),
    z.null(),
  ]).transform((val) => (typeof val === 'number' && isNaN(val) ? null : val)),
  probabilidad_pct: z.union([
    z.number().min(0).max(100),
    z.nan(),
    z.null(),
  ]).transform((val) => (typeof val === 'number' && isNaN(val) ? null : val)),
  etapa: z.enum(ETAPAS_OPORTUNIDAD, { message: 'Selecciona una etapa' }),
  fecha_cierre_estimada: z.string(),
  fecha_cierre_real: z.string(),
  motivo_perdida: z.string(),
  contacto_id: z.string(),
  responsable_id: z.string().min(1, 'Selecciona un responsable'),
  proyecto_id: z.string(),
  notas: z.string(),
}).refine(
  (data) => data.etapa !== 'Cerrada perdida' || data.motivo_perdida.trim().length > 0,
  { path: ['motivo_perdida'], message: 'Indica el motivo de la pérdida' },
)

export type OportunidadFormData = z.infer<typeof oportunidadSchema>

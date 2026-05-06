'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  email: z.string().email('Email no válido'),
})

export type ForgotPasswordResult = { success: boolean; error?: string }

export async function solicitarRestablecerPassword(
  formData: FormData,
): Promise<ForgotPasswordResult> {
  const parsed = schema.safeParse({ email: formData.get('email') })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/auth/callback?type=recovery`,
  })

  if (error) {
    console.error('[forgot-password] resetPasswordForEmail:', error)
  }

  return { success: true }
}

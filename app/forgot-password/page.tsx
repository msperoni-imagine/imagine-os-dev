'use client'

import Link from 'next/link'
import { useState } from 'react'
import { solicitarRestablecerPassword } from './actions'

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string | null>(null)
  const [enviado, setEnviado] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await solicitarRestablecerPassword(formData)

    if (!result.success) {
      setError(result.error ?? 'Algo salió mal. Inténtalo de nuevo.')
      setLoading(false)
      return
    }

    setEnviado(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F9FAFB]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Imagine OS</h1>
          <p className="text-sm text-gray-500 mt-1">Recuperar contraseña</p>
        </div>

        {enviado ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="rounded-full bg-emerald-50/60 w-12 h-12 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-emerald-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Revisa tu email</h2>
            <p className="text-sm text-gray-600 mb-6">
              Si el email está registrado, te hemos enviado un enlace para
              crear una contraseña nueva. Revisa también la carpeta de spam.
            </p>
            <Link href="/login" className="text-sm text-[#00C896] hover:underline">
              Volver al login
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-4">
              Introduce tu email y te enviaremos un enlace para crear una
              contraseña nueva.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Email corporativo
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="tu@empresa.com"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                             placeholder:text-gray-400 focus:outline-none focus:ring-2
                             focus:ring-[#00C896] focus:border-transparent"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-[#00C896] px-4 py-2 text-sm font-medium
                           text-white hover:bg-[#00B385] transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Enviando...' : 'Enviar enlace'}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-4">
              <Link href="/login" className="hover:underline">
                ← Volver al login
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

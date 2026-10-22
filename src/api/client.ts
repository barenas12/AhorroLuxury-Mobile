import { API_URL } from '@/config'

export class ApiError extends Error {
  status: number
  constructor(message: string, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

interface Envelope<T> {
  success: boolean
  message?: string
  data?: T
}

const TIMEOUT_MS = 15000

/**
 * Llama al backend. Todas las respuestas del API tienen la forma
 * { success: boolean, data?: T, message?: string }.
 * Lanza ApiError con el mensaje del servidor cuando success = false.
 */
export async function request<T = unknown>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PUT' | 'PATCH'; body?: unknown } = {},
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    })

    let json: Envelope<T> | null = null
    try {
      json = (await res.json()) as Envelope<T>
    } catch {
      json = null
    }

    if (!res.ok || !json || json.success === false) {
      throw new ApiError(json?.message || `Error del servidor (${res.status}).`, res.status)
    }

    return json.data as T
  } catch (err) {
    if (err instanceof ApiError) throw err
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError('El servidor tardó demasiado en responder.')
    }
    throw new ApiError('No fue posible conectar con el servidor.')
  } finally {
    clearTimeout(timer)
  }
}

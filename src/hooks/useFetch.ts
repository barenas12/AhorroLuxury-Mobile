import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiError } from '@/api/client'

/**
 * Carga datos al montar y permite recargar (pull-to-refresh).
 * `fetcher` debe ser estable (función de módulo o useCallback).
 */
export function useFetch<T>(fetcher: () => Promise<T>, initial: T) {
  const [data, setData] = useState<T>(initial)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await fetcher()
      if (mounted.current) setData(result)
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof ApiError ? err.message : 'Error al cargar los datos.')
      }
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [fetcher])

  useEffect(() => {
    reload()
  }, [reload])

  return { data, loading, error, reload, setData }
}

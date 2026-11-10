import AsyncStorage from '@react-native-async-storage/async-storage'
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AppState } from 'react-native'

import type { UserSession } from '@/api/types'
import { INACTIVITY_LIMIT_MS } from '@/config'
import {
  authenticateWithBiometrics,
  type BiometricSupport,
  getBiometricSupport,
  saveBiometricCredentials,
} from '@/utils/biometrics'
import { initializeNotifications } from '@/utils/notifications'

const STORAGE_USER_KEY = 'al_user_session'
const STORAGE_TIME_KEY = 'al_last_activity'

interface AuthContextValue {
  user: UserSession | null
  /** true mientras se restaura la sesión guardada */
  loading: boolean
  /** true cuando hay sesión restaurada pero requiere desbloqueo con huella o rostro */
  isBiometricLocked: boolean
  /** Información de soporte biométrico del dispositivo (huella / rostro) */
  biometricSupport: BiometricSupport
  /** Mensaje informativo (p. ej. cierre por inactividad) */
  notice: string | null
  clearNotice: () => void
  signIn: (user: UserSession, password?: string) => Promise<void>
  signOut: () => Promise<void>
  unlockWithBiometrics: () => Promise<boolean>
  markPasswordChanged: () => Promise<void>
  /** Registrar actividad del usuario (reinicia el contador de inactividad) */
  touch: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [isBiometricLocked, setIsBiometricLocked] = useState(false)
  const [biometricSupport, setBiometricSupport] = useState<BiometricSupport>({
    isAvailable: false,
    biometricType: 'none',
    label: 'Biometría',
    iconName: 'lock-closed-outline',
  })
  const [notice, setNotice] = useState<string | null>(null)

  const lastActivity = useRef<number>(Date.now())
  const lastPersist = useRef<number>(0)
  const userRef = useRef<UserSession | null>(null)
  userRef.current = user

  const clearStorage = useCallback(async () => {
    await AsyncStorage.multiRemove([STORAGE_USER_KEY, STORAGE_TIME_KEY])
  }, [])

  const signOut = useCallback(async () => {
    setUser(null)
    setIsBiometricLocked(false)
    await clearStorage()
  }, [clearStorage])

  const expireByInactivity = useCallback(async () => {
    setUser(null)
    setIsBiometricLocked(false)
    setNotice('Cerrada la sesión por inactividad')
    await clearStorage()
  }, [clearStorage])

  const touch = useCallback(() => {
    if (!userRef.current) return
    const now = Date.now()
    lastActivity.current = now
    // Persistimos como máximo cada 10 s para no saturar el almacenamiento
    if (now - lastPersist.current > 10_000) {
      lastPersist.current = now
      AsyncStorage.setItem(STORAGE_TIME_KEY, String(now)).catch(() => {})
    }
  }, [])

  const signIn = useCallback(async (session: UserSession, password?: string) => {
    const now = Date.now()
    lastActivity.current = now
    lastPersist.current = now
    setNotice(null)
    setIsBiometricLocked(false)
    setUser(session)
    await AsyncStorage.multiSet([
      [STORAGE_USER_KEY, JSON.stringify(session)],
      [STORAGE_TIME_KEY, String(now)],
    ])
    await saveBiometricCredentials({
      username: session.user,
      ...(password ? { password } : {}),
      session,
    })
    void initializeNotifications()
  }, [])

  const unlockWithBiometrics = useCallback(async (): Promise<boolean> => {
    const support = await getBiometricSupport()
    setBiometricSupport(support)
    if (!support.isAvailable) {
      setIsBiometricLocked(false)
      return true
    }

    const ok = await authenticateWithBiometrics(`Desbloquear con ${support.label}`)
    if (ok) {
      const now = Date.now()
      lastActivity.current = now
      lastPersist.current = now
      setIsBiometricLocked(false)
      AsyncStorage.setItem(STORAGE_TIME_KEY, String(now)).catch(() => {})
    }
    return ok
  }, [])

  const markPasswordChanged = useCallback(async () => {
    const current = userRef.current
    if (!current) return
    const updated = { ...current, resetPassword: 0 }
    setUser(updated)
    await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updated))
    await saveBiometricCredentials({
      username: updated.user,
      session: updated,
    })
  }, [])

  // Restaurar sesión al abrir la app y detectar soporte biométrico del dispositivo
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [support, [[, savedUser], [, savedTime]]] = await Promise.all([
          getBiometricSupport(),
          AsyncStorage.multiGet([STORAGE_USER_KEY, STORAGE_TIME_KEY]),
        ])
        if (cancelled) return
        setBiometricSupport(support)

        if (savedUser && savedTime) {
          const elapsed = Date.now() - parseInt(savedTime, 10)
          if (elapsed < INACTIVITY_LIMIT_MS) {
            const parsedUser = JSON.parse(savedUser) as UserSession
            lastActivity.current = Date.now()
            setUser(parsedUser)

            if (support.isAvailable) {
              setIsBiometricLocked(true)
            }
          } else {
            await clearStorage()
            setNotice('Cerrada la sesión por inactividad')
          }
        }
      } catch {
        // sesión corrupta: se ignora y se pide login
        await clearStorage().catch(() => {})
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clearStorage])

  // Control de inactividad: al volver a primer plano y cada minuto
  useEffect(() => {
    const check = () => {
      if (!userRef.current) return
      if (Date.now() - lastActivity.current >= INACTIVITY_LIMIT_MS) {
        expireByInactivity()
      }
    }

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check()
    })
    const interval = setInterval(check, 60_000)

    return () => {
      sub.remove()
      clearInterval(interval)
    }
  }, [expireByInactivity])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isBiometricLocked,
      biometricSupport,
      notice,
      clearNotice: () => setNotice(null),
      signIn,
      signOut,
      unlockWithBiometrics,
      markPasswordChanged,
      touch,
    }),
    [
      user,
      loading,
      isBiometricLocked,
      biometricSupport,
      notice,
      signIn,
      signOut,
      unlockWithBiometrics,
      markPasswordChanged,
      touch,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

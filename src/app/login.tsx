import { Ionicons } from '@expo/vector-icons'
import { ComponentRef, useCallback, useEffect, useRef, useState } from 'react'
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ApiError } from '@/api/client'
import { login } from '@/api/services'
import { useAuth } from '@/auth/AuthContext'
import { Button, ErrorBox } from '@/components/ui'
import { API_URL } from '@/config'
import { colors, radius, shadow } from '@/theme'
import {
  authenticateWithBiometrics,
  type BiometricSavedCredentials,
  type BiometricSupport,
  getBiometricSupport,
  getSavedBiometricCredentials,
} from '@/utils/biometrics'

export default function LoginScreen() {
  const { signIn, notice, clearNotice } = useAuth()
  const insets = useSafeAreaInsets()

  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [biometricLoading, setBiometricLoading] = useState(false)
  const [error, setError] = useState('')
  const passRef = useRef<ComponentRef<typeof TextInput>>(null)

  const [bioSupport, setBioSupport] = useState<BiometricSupport>({
    isAvailable: false,
    biometricType: 'none',
    label: 'Biometría',
    iconName: 'lock-closed-outline',
  })
  const [savedBio, setSavedBio] = useState<BiometricSavedCredentials | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [support, saved] = await Promise.all([
        getBiometricSupport(),
        getSavedBiometricCredentials(),
      ])
      if (cancelled) return
      setBioSupport(support)
      setSavedBio(saved)
      if (saved?.username) {
        setUser((prev) => prev || saved.username)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleBiometricLogin = useCallback(async () => {
    if (!bioSupport.isAvailable) {
      setError('Tu dispositivo no tiene huella o reconocimiento facial configurado.')
      return
    }
    if (!savedBio) {
      setError(
        `Inicia sesión una vez con tu usuario y contraseña para activar el desbloqueo con ${bioSupport.label.toLowerCase()}.`,
      )
      return
    }

    setBiometricLoading(true)
    setError('')
    clearNotice()

    try {
      const ok = await authenticateWithBiometrics(`Ingresar con ${bioSupport.label}`)
      if (!ok) return

      if (savedBio.password) {
        try {
          const freshSession = await login(savedBio.username, savedBio.password)
          await signIn(freshSession, savedBio.password)
          return
        } catch (err) {
          // Si falló por cambio de clave en servidor, pedimos contraseña manual
          if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
            setError('Tus credenciales cambiaron. Ingresa con tu nueva contraseña.')
            return
          }
        }
      }

      // Respaldo con la sesión verificada localmente
      await signIn(savedBio.session, savedBio.password)
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'No fue posible iniciar sesión con biometría.',
      )
    } finally {
      setBiometricLoading(false)
    }
  }, [bioSupport, savedBio, clearNotice, signIn])

  const handleSubmit = async () => {
    if (!user.trim()) {
      setError('Ingresa tu nombre de usuario.')
      return
    }
    if (!password) {
      setError('Ingresa tu contraseña.')
      return
    }

    setLoading(true)
    setError('')
    clearNotice()

    try {
      const session = await login(user.trim(), password)
      await signIn(session, password)
      // La navegación a la app la hace <Stack.Protected> al cambiar la sesión
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bgLight }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          s.container,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={require('../../assets/logo-luxury.png')} style={s.logo} resizeMode="contain" />

        <View style={s.card}>
          <View style={s.header}>
            <View style={s.badge}>
              <Text style={s.badgeText}>Portal de Socios</Text>
            </View>
            <Text style={s.title}>Iniciar Sesión</Text>
            <Text style={s.subtitle}>Ingresa para consultar el estado de tu ahorro</Text>
          </View>

          {notice ? (
            <View style={s.notice}>
              <Text style={s.noticeText}>{notice}</Text>
            </View>
          ) : null}

          <ErrorBox message={error} />

          <Text style={s.label}>Usuario</Text>
          <TextInput
            style={s.input}
            value={user}
            onChangeText={setUser}
            placeholder="Tu nombre de usuario"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => passRef.current?.focus()}
          />

          <Text style={[s.label, { marginTop: 14 }]}>Contraseña</Text>
          <View style={s.passRow}>
            <TextInput
              ref={passRef}
              style={[s.input, { flex: 1 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.muted}
              secureTextEntry={!showPass}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
            />
            <Pressable onPress={() => setShowPass((v) => !v)} style={s.eye} hitSlop={8}>
              <Text style={{ color: colors.secondary, fontWeight: '600' }}>
                {showPass ? 'Ocultar' : 'Ver'}
              </Text>
            </Pressable>
          </View>

          <Button
            title="Ingresar al Portal"
            onPress={handleSubmit}
            loading={loading}
            style={{ marginTop: 22 }}
          />

          {bioSupport.isAvailable ? (
            <Pressable
              onPress={handleBiometricLogin}
              disabled={biometricLoading || loading}
              style={({ pressed }) => [
                s.bioButton,
                pressed && { opacity: 0.78 },
                (biometricLoading || loading) && { opacity: 0.5 },
              ]}
            >
              <View style={s.bioIconWrap}>
                <Ionicons name={bioSupport.iconName} size={22} color={colors.secondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.bioTitle}>Desbloquear con {bioSupport.label}</Text>
                <Text style={s.bioSubtitle} numberOfLines={1}>
                  {savedBio
                    ? `Ingreso rápido como ${savedBio.session.full_name || savedBio.username}`
                    : 'Inicia sesión una vez para vincular tu huella o rostro'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.secondary} />
            </Pressable>
          ) : null}
        </View>

        {__DEV__ ? <Text style={s.devUrl}>API: {API_URL}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  logo: { width: 110, height: 110, marginBottom: 16 },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    ...shadow,
  },
  header: { alignItems: 'center', marginBottom: 20 },
  badge: {
    backgroundColor: colors.successBg,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 10,
  },
  badgeText: { color: colors.secondary, fontSize: 12, fontWeight: '700' },
  title: { fontSize: 26, fontWeight: '800', color: colors.primary },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 4, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: colors.primary, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 13 : 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: '#fff',
  },
  passRow: { flexDirection: 'row', alignItems: 'center' },
  eye: { position: 'absolute', right: 14 },
  notice: {
    backgroundColor: colors.primary,
    borderLeftWidth: 5,
    borderLeftColor: colors.danger,
    padding: 12,
    borderRadius: 8,
    marginBottom: 14,
  },
  noticeText: { color: colors.bgLight, fontWeight: '600', fontSize: 13 },
  bioButton: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(31, 122, 99, 0.35)',
    backgroundColor: colors.successBg,
  },
  bioIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioTitle: { fontSize: 14, fontWeight: '700', color: colors.primary },
  bioSubtitle: { fontSize: 12, color: colors.textSoft, marginTop: 1 },
  devUrl: { marginTop: 16, fontSize: 11, color: colors.muted },
})

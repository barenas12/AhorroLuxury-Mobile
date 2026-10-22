import { ComponentRef, useRef, useState } from 'react'
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

export default function LoginScreen() {
  const { signIn, notice, clearNotice } = useAuth()
  const insets = useSafeAreaInsets()

  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const passRef = useRef<ComponentRef<typeof TextInput>>(null)

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
      await signIn(session)
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
  devUrl: { marginTop: 16, fontSize: 11, color: colors.muted },
})

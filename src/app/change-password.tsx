import { useMemo, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ApiError } from '@/api/client'
import { changePasswordFirstLogin } from '@/api/services'
import { useAuth } from '@/auth/AuthContext'
import { Button, ErrorBox, Field } from '@/components/ui'
import { colors, radius, shadow } from '@/theme'

export default function ChangePasswordScreen() {
  const { user, markPasswordChanged, signOut } = useAuth()
  const insets = useSafeAreaInsets()

  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Mismas reglas que ChangePasswordModal.vue de la web
  const rules = useMemo(() => {
    const pass = newPassword.toLowerCase()
    const personal = [user?.user, user?.name, user?.lastName]
      .map((v) => (v || '').toLowerCase())
      .filter(Boolean)
    const containsPersonalData = !!pass && personal.some((p) => pass.includes(p))

    return {
      minLength: newPassword.length >= 8,
      upper: /[A-Z]/.test(newPassword),
      lower: /[a-z]/.test(newPassword),
      number: /\d/.test(newPassword),
      special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword),
      containsPersonalData,
      match: newPassword.length > 0 && newPassword === confirm,
    }
  }, [newPassword, confirm, user])

  const isValid =
    rules.minLength &&
    rules.upper &&
    rules.lower &&
    rules.number &&
    rules.special &&
    !rules.containsPersonalData &&
    rules.match

  const handleSubmit = async () => {
    if (!isValid || !user) return
    setLoading(true)
    setError('')
    try {
      await changePasswordFirstLogin(user.user, newPassword)
      await markPasswordChanged()
      // <Stack.Protected> te lleva al panel al cambiar resetPassword a 0
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al actualizar contraseña')
    } finally {
      setLoading(false)
    }
  }

  const Rule = ({ ok, danger, text }: { ok: boolean; danger?: boolean; text: string }) => (
    <Text
      style={[
        s.rule,
        ok && { color: colors.secondary, fontWeight: '600' },
        danger && { color: colors.danger, fontWeight: '600' },
      ]}
    >
      {ok ? '✓ ' : '• '}
      {text}
    </Text>
  )

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.primary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: 20,
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 20,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.card}>
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <View style={s.badge}>
              <Text style={s.badgeText}>Primer Ingreso</Text>
            </View>
            <Text style={s.title}>Actualización Obligatoria de Contraseña</Text>
            <Text style={s.subtitle}>
              Por seguridad de tus ahorros en Ahorro Luxury, debes definir una contraseña
              personalizada.
            </Text>
          </View>

          <ErrorBox message={error} />

          <Field
            label="Nueva Contraseña"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="••••••••"
          />
          <Field
            label="Confirmar Contraseña"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            placeholder="••••••••"
          />

          <View style={{ marginBottom: 16, gap: 4 }}>
            <Rule ok={rules.minLength} text="Mínimo 8 caracteres" />
            <Rule ok={rules.upper} text="Al menos una letra mayúscula" />
            <Rule ok={rules.lower} text="Al menos una letra minúscula" />
            <Rule ok={rules.number} text="Al menos un número" />
            <Rule ok={rules.special} text="Al menos un carácter especial (!@#$%...)" />
            <Rule
              ok={!rules.containsPersonalData && newPassword.length > 0}
              danger={rules.containsPersonalData}
              text="No debe contener tu nombre, apellido o documento"
            />
            <Rule ok={rules.match} text="Las contraseñas coinciden" />
          </View>

          <Button
            title="Establecer Contraseña e Ingresar"
            onPress={handleSubmit}
            disabled={!isValid}
            loading={loading}
          />
          <Button title="Cerrar sesión" variant="ghost" onPress={signOut} style={{ marginTop: 6 }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: radius,
    padding: 22,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    ...shadow,
  },
  badge: {
    backgroundColor: colors.successBg,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: { color: colors.secondary, fontWeight: '700', fontSize: 12 },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'center',
    marginTop: 10,
  },
  subtitle: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 6 },
  rule: { fontSize: 12.5, color: '#A0AEC0' },
})

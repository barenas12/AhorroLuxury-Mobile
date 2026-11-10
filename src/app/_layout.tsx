import { Ionicons } from '@expo/vector-icons'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AuthProvider, useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui'
import { colors, radius, shadow } from '@/theme'

function BiometricLockScreen() {
  const { user, biometricSupport, unlockWithBiometrics, signOut } = useAuth()
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void unlockWithBiometrics()
  }, [unlockWithBiometrics])

  const handleUnlock = async () => {
    setBusy(true)
    try {
      await unlockWithBiometrics()
    } finally {
      setBusy(false)
    }
  }

  const displayName = user?.full_name || user?.name || user?.user || 'Socio'

  return (
    <View style={s.lockContainer}>
      <Image
        source={require('../../assets/logo-luxury.png')}
        style={s.logo}
        resizeMode="contain"
      />
      <View style={s.card}>
        <View style={s.iconCircle}>
          <Ionicons name={biometricSupport.iconName} size={38} color={colors.secondary} />
        </View>
        <Text style={s.title}>Sesión Protegida</Text>
        <Text style={s.subtitle}>
          Hola, <Text style={{ fontWeight: '700', color: colors.primary }}>{displayName}</Text>.
          Verifica tu identidad con {biometricSupport.label.toLowerCase()} para continuar.
        </Text>

        <Button
          title={`Desbloquear con ${biometricSupport.label}`}
          onPress={handleUnlock}
          loading={busy}
          style={{ width: '100%', marginTop: 18 }}
        />

        <Button
          title="Usar contraseña o cambiar cuenta"
          variant="ghost"
          onPress={signOut}
          style={{ width: '100%', marginTop: 8 }}
        />
      </View>
    </View>
  )
}

function RootNavigator() {
  const { user, loading, isBiometricLocked, touch } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgLight }}>
        <ActivityIndicator color={colors.secondary} size="large" />
      </View>
    )
  }

  if (user && isBiometricLocked) {
    return <BiometricLockScreen />
  }

  const needsPasswordChange = !!user && Number(user.resetPassword) === 1

  return (
    // onTouchStart registra actividad para el cierre por inactividad (30 min)
    <View style={{ flex: 1 }} onTouchStart={touch}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="login" />
        </Stack.Protected>

        <Stack.Protected guard={needsPasswordChange}>
          <Stack.Screen name="change-password" />
        </Stack.Protected>

        <Stack.Protected guard={!!user && !needsPasswordChange}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </View>
  )
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  )
}

const s = StyleSheet.create({
  lockContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: colors.bgLight,
  },
  logo: { width: 100, height: 100, marginBottom: 16 },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    ...shadow,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.primary, textAlign: 'center' },
  subtitle: {
    fontSize: 14,
    color: colors.textSoft,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
})

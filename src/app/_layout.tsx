import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { AuthProvider, useAuth } from '@/auth/AuthContext'
import { colors } from '@/theme'

function RootNavigator() {
  const { user, loading, touch } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgLight }}>
        <ActivityIndicator color={colors.secondary} size="large" />
      </View>
    )
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

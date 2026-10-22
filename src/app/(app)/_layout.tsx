import { Stack } from 'expo-router'
import { View } from 'react-native'

import { useAuth } from '@/auth/AuthContext'
import BottomNavigation from '@/components/BottomNavigation'
import SignOutButton from '@/components/SignOutButton'
import { colors } from '@/theme'

export default function AppLayout() {
  const { user } = useAuth()
  // Igual que la web: el perfil 3 (socio) no accede a los módulos de gestión
  const canManage = Number(user?.profile) !== 3

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgLight }}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
          headerBackTitle: 'Atrás',
          headerRight: () => <SignOutButton variant="header" />,
          contentStyle: { backgroundColor: colors.bgLight },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />

        <Stack.Protected guard={canManage}>
          <Stack.Screen name="usuarios" options={{ title: 'Usuarios' }} />
          <Stack.Screen name="ahorro" options={{ title: 'Ahorro Programado' }} />
          <Stack.Screen name="rifa/[type]" options={{ title: 'Rifa' }} />
          <Stack.Screen name="prestamos" options={{ title: 'Préstamos y Respaldos' }} />
          <Stack.Screen name="pagos" options={{ title: 'Pagos y Multas' }} />
          <Stack.Screen name="egresos" options={{ title: 'Control de Egresos' }} />
        </Stack.Protected>
      </Stack>
      <BottomNavigation />
    </View>
  )
}

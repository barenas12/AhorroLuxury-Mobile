import { Ionicons } from '@expo/vector-icons'
import { Alert, Pressable, StyleSheet, Text } from 'react-native'

import { useAuth } from '@/auth/AuthContext'
import { colors } from '@/theme'

export default function SignOutButton({ variant = 'header' }: { variant?: 'header' | 'dashboard' }) {
  const { signOut } = useAuth()

  const confirmSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Deseas cerrar tu sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => signOut() },
    ])
  }

  const isHeader = variant === 'header'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Cerrar sesión"
      onPress={confirmSignOut}
      hitSlop={8}
      style={[styles.button, isHeader ? styles.headerButton : styles.dashboardButton]}
    >
      <Ionicons
        name="log-out-outline"
        size={18}
        color={isHeader ? '#fff' : colors.danger}
      />
      <Text style={[styles.label, isHeader ? styles.headerLabel : styles.dashboardLabel]}>
        Salir
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 8,
  },
  headerButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  dashboardButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.dangerBg,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  headerLabel: {
    color: '#fff',
  },
  dashboardLabel: {
    color: colors.danger,
  },
})

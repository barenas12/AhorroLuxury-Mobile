import { Ionicons } from '@expo/vector-icons'
import { usePathname, useRouter } from 'expo-router'
import { useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAuth } from '@/auth/AuthContext'
import { Sheet } from '@/components/ui'
import { colors, shadow } from '@/theme'

const MODULES = [
  { id: 'rifa1', label: 'Rifa Mensual 1', icon: require('../../assets/icons/raffle.png'), href: '/rifa/1' },
  { id: 'rifa2', label: 'Rifa Mensual 2', icon: require('../../assets/icons/raffle.png'), href: '/rifa/2' },
  { id: 'prestamos', label: 'Préstamos y Respaldos', icon: require('../../assets/icons/loans.png'), href: '/prestamos' },
  { id: 'egresos', label: 'Control de Egresos', href: '/egresos' },
] as const

const TAB_ITEMS = [
  { id: 'home', label: 'Inicio', href: '/', icon: require('../../assets/icons/dashboard.png') },
  { id: 'savings', label: 'Ahorro', href: '/ahorro', icon: require('../../assets/icons/savings.png') },
  { id: 'payments', label: 'Pagos', href: '/pagos', icon: require('../../assets/icons/pay.png') },
  { id: 'users', label: 'Usuarios', href: '/usuarios', icon: require('../../assets/icons/users.png') },
] as const

export default function BottomNavigation() {
  const { user } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [modulesVisible, setModulesVisible] = useState(false)
  const canManage = Number(user?.profile) !== 3

  const isCurrentRoute = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(`${href}/`))
  const isModuleActive = MODULES.some((module) => isCurrentRoute(module.href))

  const navigate = (href: string) => {
    setModulesVisible(false)
    if (!isCurrentRoute(href)) router.replace(href as never)
  }

  const renderTab = (
    item: (typeof TAB_ITEMS)[number],
  ) => (
    <Pressable
      key={item.id}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: isCurrentRoute(item.href) }}
      onPress={() => navigate(item.href)}
      style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
    >
      <Image source={item.icon} style={[styles.tabIcon, isCurrentRoute(item.href) && styles.tabIconActive]} resizeMode="contain" />
      <Text style={[styles.tabLabel, isCurrentRoute(item.href) && styles.activeLabel]}>{item.label}</Text>
    </Pressable>
  )

  return (
    <>
      <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
        <View style={styles.row}>
          {renderTab(TAB_ITEMS[0])}
          {canManage ? renderTab(TAB_ITEMS[1]) : null}

          {canManage ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir módulos"
              onPress={() => setModulesVisible(true)}
              style={({ pressed }) => [styles.moduleTab, pressed && styles.pressed]}
            >
              <View style={[styles.moduleButton, isModuleActive && styles.moduleButtonActive]}>
                <Ionicons name="add" size={28} color="#fff" />
              </View>
              <Text style={[styles.tabLabel, isModuleActive && styles.activeLabel]}>Módulos</Text>
            </Pressable>
          ) : null}

          {canManage ? renderTab(TAB_ITEMS[2]) : null}
          {canManage ? renderTab(TAB_ITEMS[3]) : null}
        </View>
      </View>

      {canManage ? (
        <Sheet
          visible={modulesVisible}
          title="Módulos"
          onClose={() => setModulesVisible(false)}
        >
          <View style={styles.moduleGrid}>
            {MODULES.map((module) => {
              const active = isCurrentRoute(module.href)
              return (
                <Pressable
                  key={module.id}
                  accessibilityRole="button"
                  onPress={() => navigate(module.href)}
                  style={({ pressed }) => [
                    styles.moduleItem,
                    active && styles.moduleItemActive,
                    pressed && styles.pressed,
                  ]}
                >
                  {'icon' in module ? (
                    <Image source={module.icon} style={styles.moduleIcon} resizeMode="contain" />
                  ) : (
                    <Ionicons name="trending-down-outline" size={26} color={colors.primary} />
                  )}
                  <Text style={styles.moduleLabel}>{module.label}</Text>
                </Pressable>
              )
            })}
          </View>
        </Sheet>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    ...shadow,
  },
  row: {
    height: 66,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tab: {
    flex: 1,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  tabLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '500',
  },
  activeLabel: {
    color: colors.secondary,
    fontWeight: '700',
  },
  tabIcon: {
    width: 25,
    height: 25,
  },
  tabIconActive: {
    tintColor: colors.secondary,
  },
  moduleTab: {
    flex: 1,
    height: 66,
    alignItems: 'center',
  },
  moduleButton: {
    width: 54,
    height: 54,
    marginTop: -16,
    borderRadius: 27,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  moduleIcon: {
    width: 34,
    height: 34,
  },
  moduleButtonActive: {
    backgroundColor: colors.primary,
  },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  moduleItem: {
    width: '48%',
    minHeight: 94,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  moduleItemActive: {
    borderColor: colors.secondary,
    backgroundColor: colors.successBg,
  },
  moduleLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
})

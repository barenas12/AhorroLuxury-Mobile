import { Stack, useLocalSearchParams } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { getRaffle } from '@/api/services'
import type { RaffleItem } from '@/api/types'
import { Card, ErrorBox, InfoRow, Loading, SearchBar, StatCard } from '@/components/ui'
import { useFetch } from '@/hooks/useFetch'
import { colors } from '@/theme'

const INITIAL: RaffleItem[] = []

export default function RaffleScreen() {
  const { type } = useLocalSearchParams<{ type: string }>()
  const raffleType: '1' | '2' = type === '2' ? '2' : '1'
  const title = `Rifa Mensual ${raffleType}`
  const insets = useSafeAreaInsets()

  const fetcher = useCallback(() => getRaffle(raffleType), [raffleType])
  const { data: board, loading, error, reload } = useFetch(fetcher, INITIAL)

  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<RaffleItem | null>(null)

  const totalAssigned = board.filter((b) => b.isAssigned).length
  const totalAvailable = 100 - totalAssigned

  const q = filter.toLowerCase().trim()
  const matches = useCallback(
    (item: RaffleItem) => {
      if (!q) return true
      return (
        item.number.includes(q) ||
        !!(
          item.partner &&
          (item.partner.fullName.toLowerCase().includes(q) ||
            String(item.partner.documentId).toLowerCase().includes(q))
        )
      )
    },
    [q],
  )

  const visible = useMemo(() => board.filter(matches), [board, matches])

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.secondary} />}
    >
      <Stack.Screen options={{ title }} />

      <ErrorBox message={error} />

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        <StatCard label="Asignados" value={totalAssigned} tone="green" />
        <StatCard label="Disponibles" value={totalAvailable} tone="orange" />
        <StatCard label="Ocupación" value={`${totalAssigned}%`} />
      </View>

      <SearchBar value={filter} onChangeText={setFilter} placeholder="Buscar número, socio o documento" />

      {loading && board.length === 0 ? (
        <Loading />
      ) : (
        <View style={s.grid}>
          {visible.map((item) => {
            const active = selected?.number === item.number
            return (
              <Pressable
                key={item.number}
                onPress={() => setSelected(item)}
                style={[
                  s.cell,
                  item.isAssigned ? s.cellAssigned : s.cellFree,
                  active && { borderColor: colors.primary, borderWidth: 2 },
                ]}
              >
                <Text style={[s.cellText, { color: item.isAssigned ? '#fff' : colors.textSoft }]}>
                  {item.number}
                </Text>
              </Pressable>
            )
          })}
        </View>
      )}

      {selected ? (
        <Card style={{ marginTop: 16 }}>
          <Text style={s.selTitle}>Número {selected.number}</Text>
          {selected.isAssigned && selected.partner ? (
            <View style={{ marginTop: 6 }}>
              <InfoRow label="Socio" value={selected.partner.fullName} />
              <InfoRow label="Documento" value={String(selected.partner.documentId)} />
              <InfoRow label="Celular" value={String(selected.partner.cellphone)} />
              <Pressable
                onPress={() => Linking.openURL(`tel:${selected.partner?.cellphone}`)}
                style={s.callBtn}
              >
                <Text style={s.callText}>📞 Llamar</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={{ color: colors.secondary, fontWeight: '600', marginTop: 6 }}>Disponible</Text>
          )}
        </Card>
      ) : null}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-start' },
  cell: {
    width: '18%',
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  cellAssigned: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  cellFree: { backgroundColor: '#fff', borderColor: colors.border },
  cellText: { fontWeight: '800', fontSize: 15 },
  selTitle: { fontSize: 18, fontWeight: '800', color: colors.primary },
  callBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: colors.successBg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  callText: { color: colors.secondary, fontWeight: '700' },
})

import { useMemo, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { getSavingsDashboard } from '@/api/services'
import type { PartnerSavings } from '@/api/types'
import {
  Badge,
  Card,
  Empty,
  ErrorBox,
  InfoRow,
  Loading,
  ScreenTitle,
  SearchBar,
  Segmented,
  StatCard,
  listContent,
} from '@/components/ui'
import { useFetch } from '@/hooks/useFetch'
import { colors } from '@/theme'
import { formatCurrency } from '@/utils/format'

type Filter = 'todos' | 'al_dia' | 'en_mora'
const INITIAL: PartnerSavings[] = []

export default function AhorroScreen() {
  const insets = useSafeAreaInsets()
  const { data: partners, loading, error, reload } = useFetch(getSavingsDashboard, INITIAL)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('todos')

  const isOk = (p: PartnerSavings) => p.savingsStatus === 'Al día' && p.generalTicketStatus === 'Al día'

  const filtered = useMemo(() => {
    let list = partners
    if (filter === 'al_dia') list = list.filter(isOk)
    else if (filter === 'en_mora') list = list.filter((p) => !isOk(p))

    const q = search.toLowerCase().trim()
    if (q) {
      list = list.filter(
        (p) =>
          p.fullName.toLowerCase().includes(q) ||
          String(p.documentId).toLowerCase().includes(q) ||
          p.coordinatorName.toLowerCase().includes(q),
      )
    }
    return list
  }, [partners, filter, search])

  const totalAlDia = partners.filter(isOk).length
  const totalEnMora = partners.length - totalAlDia
  const carteraMora = partners.reduce((acc, p) => acc + Number(p.overdueAmount || 0), 0)

  const header = (
    <View>
      <ScreenTitle
        title="Ahorro Programado"
        subtitle="Ahorro neto, deuda en mora y estado de boletas."
      />
      <ErrorBox message={error} />
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
        <StatCard label="Ahorradores" value={partners.length} desc="Socios activos" />
        <StatCard label="Al día" value={totalAlDia} tone="green" desc="Sin deuda" />
      </View>
      <StatCard
        label="Cartera en mora"
        value={formatCurrency(carteraMora)}
        desc={`${totalEnMora} socios con saldo pendiente`}
        tone="orange"
        style={{ flex: 0, marginBottom: 14 }}
      />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Buscar por nombre, documento o coordinador" />
      <Segmented<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'todos', label: 'Todos' },
          { value: 'al_dia', label: 'Al día' },
          { value: 'en_mora', label: 'En mora' },
        ]}
      />
    </View>
  )

  return (
    <FlatList
      data={filtered}
      keyExtractor={(p) => String(p.id)}
      contentContainerStyle={listContent(insets.bottom)}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.secondary} />}
      ListHeaderComponent={header}
      ListEmptyComponent={loading ? <Loading /> : <Empty text="No se encontraron socios." />}
      renderItem={({ item: p }) => {
        const inArrears = p.savingsStatus === 'En mora'
        return (
          <Card>
            <View style={s.top}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{p.fullName}</Text>
                <Text style={s.sub}>
                  C.C. {p.documentId} · Coord.: {p.coordinatorName}
                </Text>
              </View>
              <Badge text={p.savingsStatus} tone={inArrears ? 'red' : 'green'} />
            </View>

            <InfoRow label="Valor de ahorro" value={formatCurrency(p.savingsValue)} />
            <InfoRow label="Frecuencia" value={`Cada ${p.frequency} días`} />
            <InfoRow label="Ahorrado (neto)" value={formatCurrency(p.totalSavedCurrentPeriod)} />
            <InfoRow
              label="Valor en mora"
              value={
                <Text style={[s.value, p.overdueAmount > 0 && { color: colors.danger }]}>
                  {formatCurrency(p.overdueAmount)}
                </Text>
              }
            />
            <InfoRow label="Próximo vencimiento" value={p.nextDueDate} />
            <InfoRow
              label="Días restantes"
              value={
                <Text style={[s.value, p.daysRemaining < 0 && { color: colors.danger }]}>
                  {p.daysRemaining}
                </Text>
              }
            />

            {p.ticketsStatus.length > 0 ? (
              <View style={{ marginTop: 10 }}>
                <Text style={s.ticketsTitle}>Boletas</Text>
                <View style={s.ticketsWrap}>
                  {p.ticketsStatus.map((t) => (
                    <View
                      key={`${t.raffle}-${t.number}`}
                      style={[s.ticket, t.isPaid ? s.ticketOk : s.ticketBad]}
                    >
                      <Text style={[s.ticketText, { color: t.isPaid ? colors.secondary : colors.dangerText }]}>
                        {t.raffle === 'Rifa 1' ? 'R1' : 'R2'} · {t.number} {t.isPaid ? '✓' : '✗'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </Card>
        )
      }}
    />
  )
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  name: { fontSize: 16, fontWeight: '700', color: colors.primary },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  value: { fontSize: 13, fontWeight: '600', color: colors.text },
  ticketsTitle: { fontSize: 12, fontWeight: '700', color: colors.primary, marginBottom: 6 },
  ticketsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ticket: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  ticketOk: { backgroundColor: colors.successBg, borderColor: 'rgba(31,122,99,0.3)' },
  ticketBad: { backgroundColor: colors.dangerBg, borderColor: 'rgba(229,62,62,0.3)' },
  ticketText: { fontSize: 12, fontWeight: '600' },
})

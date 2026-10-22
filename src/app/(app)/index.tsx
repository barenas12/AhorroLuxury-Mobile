import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ApiError } from '@/api/client'
import { getDashboardSummary } from '@/api/services'
import type { DashboardData } from '@/api/types'
import { useAuth } from '@/auth/AuthContext'
import { Badge, Card, ErrorBox, Loading } from '@/components/ui'
import SignOutButton from '@/components/SignOutButton'
import { colors, radius, shadow } from '@/theme'
import { formatCurrency, roleLabel } from '@/utils/format'

export default function DashboardScreen() {
  const { user } = useAuth()
  const insets = useSafeAreaInsets()

  const isProfileThree = Number(user?.profile) === 3

  const [data, setData] = useState<DashboardData>({ recaudo: [], salidas: [], capitalPrestadoTotal: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await getDashboardSummary())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error cargando el dashboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isProfileThree) load()
  }, [isProfileThree, load])

  // ---- Matemática financiera (idéntica a FinancialDashboard.vue) ----
  const m = useMemo(() => {
    const sumIn = (method: string) =>
      data.recaudo
        .filter((r) => r.paymentMethod === method)
        .reduce((acc, r) => acc + Number(r.totalAmount) + Number(r.totalFines), 0)
    const sumOut = (method: string) =>
      (data.salidas || [])
        .filter((e) => e.paymentMethod === method)
        .reduce((acc, e) => acc + Number(e.totalEgress), 0)

    const efectivo = sumIn('efectivo') - sumOut('efectivo')
    const transferencia = sumIn('transferencia') - sumOut('transferencia')
    const liquidez = efectivo + transferencia

    const capitalRecuperado = data.recaudo
      .filter((r) => r.concept === 'Abono Capital Préstamo')
      .reduce((acc, r) => acc + Number(r.totalAmount), 0)
    const capitalEnCalle = Number(data.capitalPrestadoTotal) - capitalRecuperado

    const intereses = data.recaudo
      .filter((r) => r.concept === 'Abono Interés Préstamo')
      .reduce((acc, r) => acc + Number(r.totalAmount), 0)
    const multas = data.recaudo.reduce((acc, r) => acc + Number(r.totalFines), 0)

    return {
      efectivo,
      transferencia,
      liquidez,
      capitalEnCalle,
      patrimonio: liquidez + capitalEnCalle,
      intereses,
      multas,
      ganancia: intereses + multas,
    }
  }, [data])

  const displayName = user?.full_name || user?.name || user?.user || 'Usuario'
  const roleTone = Number(user?.profile) === 1 ? 'navy' : Number(user?.profile) === 2 ? 'green' : 'gray'

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bgLight }}
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }}
      refreshControl={
        isProfileThree ? undefined : <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.secondary} />
      }
    >
      {/* Cabecera de usuario */}
      <View style={s.userBar}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{displayName.trim().charAt(0).toUpperCase() || 'U'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.userName} numberOfLines={1}>
            {displayName}
          </Text>
          <Badge text={roleLabel(user?.profile)} tone={roleTone} />
        </View>
        <SignOutButton variant="dashboard" />
      </View>

      {isProfileThree ? (
        <Card style={{ alignItems: 'center', padding: 28 }}>
          <Text style={{ fontSize: 44, marginBottom: 12 }}>🔒</Text>
          <Text style={s.lockTitle}>Dashboard no disponible</Text>
          <Text style={s.lockText}>
            Hola, <Text style={{ fontWeight: '700' }}>{displayName}</Text>. Tu usuario está registrado en el
            sistema, pero no cuentas con permisos de <Text style={{ fontWeight: '700' }}>Administrador (1)</Text>{' '}
            ni de <Text style={{ fontWeight: '700' }}>Coordinador (2)</Text> para ver este contenido.
          </Text>
          <Text style={s.lockSmall}>
            Comunícate con la administración de Ahorro Luxury para solicitar autorización.
          </Text>
        </Card>
      ) : (
        <>
          <Text style={s.h1}>Dashboard Financiero</Text>
          <Text style={s.sub}>Resumen global de caja, ganancias y patrimonio.</Text>

          <ErrorBox message={error} />

          {loading && data.recaudo.length === 0 ? (
            <Loading />
          ) : (
            <>
              <View style={[s.kpi, { backgroundColor: colors.primary }]}>
                <Text style={s.kpiTitle}>Patrimonio Total del Fondo</Text>
                <Text style={s.kpiValue}>{formatCurrency(m.patrimonio)}</Text>
                <View style={s.kpiRow}>
                  <Text style={s.kpiSmall}>Liquidez: {formatCurrency(m.liquidez)}</Text>
                  <Text style={s.kpiSmall}>Préstamos: {formatCurrency(m.capitalEnCalle)}</Text>
                </View>
              </View>

              <View style={[s.kpi, { backgroundColor: colors.secondary }]}>
                <Text style={s.kpiTitle}>Ganancia Neta Acumulada</Text>
                <Text style={s.kpiValue}>{formatCurrency(m.ganancia)}</Text>
                <View style={s.kpiRow}>
                  <Text style={s.kpiSmall}>Intereses: {formatCurrency(m.intereses)}</Text>
                  <Text style={s.kpiSmall}>Multas: {formatCurrency(m.multas)}</Text>
                </View>
              </View>

              <View style={s.boxes}>
                <Card style={s.box}>
                  <Text style={{ fontSize: 24 }}>💵</Text>
                  <Text style={s.boxTitle}>Efectivo</Text>
                  <Text style={[s.boxAmount, m.efectivo < 0 && { color: colors.danger }]}>
                    {formatCurrency(m.efectivo)}
                  </Text>
                  <Text style={s.boxDesc}>Dinero real en mano</Text>
                </Card>
                <Card style={s.box}>
                  <Text style={{ fontSize: 24 }}>🏦</Text>
                  <Text style={s.boxTitle}>Bancos</Text>
                  <Text style={[s.boxAmount, m.transferencia < 0 && { color: colors.danger }]}>
                    {formatCurrency(m.transferencia)}
                  </Text>
                  <Text style={s.boxDesc}>Cuentas / Nequi</Text>
                </Card>
              </View>
            </>
          )}

          {/* Desglose de ingresos */}
          {data.recaudo.length > 0 ? (
            <>
              <Text style={[s.h2, { marginTop: 16 }]}>Desglose de Ingresos por Concepto</Text>
              {data.recaudo.map((r, idx) => (
                <Card key={`${r.concept}-${r.paymentMethod}-${idx}`} style={{ padding: 12 }}>
                  <View style={s.rowBetween}>
                    <Text style={s.concept} numberOfLines={1}>
                      {r.concept}
                    </Text>
                    <Badge
                      text={String(r.paymentMethod).toUpperCase()}
                      tone={r.paymentMethod === 'efectivo' ? 'green' : 'navy'}
                    />
                  </View>
                  <View style={[s.rowBetween, { marginTop: 8 }]}>
                    <Text style={s.small}>Recaudado: {formatCurrency(r.totalAmount)}</Text>
                    <Text style={s.small}>Multas: {formatCurrency(r.totalFines)}</Text>
                  </View>
                  <Text style={s.total}>
                    Total: {formatCurrency(Number(r.totalAmount) + Number(r.totalFines))}
                  </Text>
                </Card>
              ))}
            </>
          ) : null}
        </>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  userBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 16,
    ...shadow,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  userName: { fontSize: 15, fontWeight: '700', color: colors.primary, marginBottom: 4 },
  lockTitle: { fontSize: 22, fontWeight: '800', color: colors.primary, marginBottom: 10 },
  lockText: { color: colors.textSoft, lineHeight: 22, textAlign: 'center', marginBottom: 14 },
  lockSmall: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  h1: { fontSize: 22, fontWeight: '800', color: colors.primary },
  h2: { fontSize: 17, fontWeight: '700', color: colors.primary, marginBottom: 10 },
  sub: { color: colors.muted, fontSize: 13, marginBottom: 14, marginTop: 2 },
  kpi: { borderRadius: radius, padding: 16, marginBottom: 12 },
  kpiTitle: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
  kpiValue: { color: '#fff', fontSize: 28, fontWeight: '800', marginVertical: 6 },
  kpiRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
  kpiSmall: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  boxes: { flexDirection: 'row', gap: 12 },
  box: { flex: 1, marginBottom: 12 },
  boxTitle: { fontSize: 14, fontWeight: '700', color: colors.primary, marginTop: 6 },
  boxAmount: { fontSize: 18, fontWeight: '800', color: colors.secondary, marginVertical: 2 },
  boxDesc: { fontSize: 11, color: colors.muted },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  concept: { fontWeight: '700', color: colors.primary, flex: 1 },
  small: { color: colors.textSoft, fontSize: 12.5 },
  total: { marginTop: 6, fontWeight: '800', color: colors.primary, textAlign: 'right' },
})

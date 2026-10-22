import { useCallback, useMemo, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Switch, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ApiError } from '@/api/client'
import { createPayments, getActivePartners, getPayments } from '@/api/services'
import type { PartnerOption, PaymentMethod, PaymentRecord } from '@/api/types'
import { useAuth } from '@/auth/AuthContext'
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorBox,
  Field,
  InfoRow,
  Loading,
  MoneyField,
  ScreenTitle,
  SearchBar,
  Segmented,
  SelectField,
  Sheet,
  StatCard,
  listContent,
} from '@/components/ui'
import { useFetch } from '@/hooks/useFetch'
import { colors } from '@/theme'
import { formatCurrency, formatDate, isValidDate, parseTickets, todayISO } from '@/utils/format'

const CONCEPTS = ['Abono Ahorro', 'Pago Boleta', 'Pago Cuota Préstamo', 'Multa', 'Otro Aporte']
const TICKET_PRICE = 30000

interface RowState {
  key: number
  concept: string
  ticketNumber?: string
  amount: number
  paymentMethod: PaymentMethod
  paymentDate: string
  observations: string
  hasFine: boolean
  fineAmount: number
}

const EMPTY_PAYMENTS: PaymentRecord[] = []
const EMPTY_PARTNERS: PartnerOption[] = []

let rowKey = 0

export default function PagosScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()

  const { data: payments, loading, error, reload: reloadPayments } = useFetch(getPayments, EMPTY_PAYMENTS)
  const { data: partners } = useFetch(getActivePartners, EMPTY_PARTNERS)

  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState<'todos' | PaymentMethod>('todos')

  const [showModal, setShowModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [modalError, setModalError] = useState('')
  const [partnerId, setPartnerId] = useState(0)
  const [rows, setRows] = useState<RowState[]>([])

  const selectedPartner = partners.find((p) => p.id === partnerId)
  const partnerTickets = useMemo(() => parseTickets(selectedPartner?.ticket), [selectedPartner])
  const partnerSavings = Number(selectedPartner?.savingsValue || 0)

  // ---------- Filas del formulario ----------
  const availableTicketsFor = (rowsList: RowState[], index: number, tickets: string[]) => {
    const taken = rowsList
      .filter((r, i) => i !== index && r.concept === 'Pago Boleta' && r.ticketNumber)
      .map((r) => r.ticketNumber as string)
    return tickets.filter((t) => !taken.includes(t))
  }

  const defaultRow = (savings: number): RowState => ({
    key: ++rowKey,
    concept: 'Abono Ahorro',
    amount: savings || 50000,
    paymentMethod: 'efectivo',
    paymentDate: todayISO(),
    observations: '',
    hasFine: false,
    fineAmount: 5000,
  })

  /** Aplica las reglas por concepto (igual que onConceptChange en la web) */
  const applyConcept = (
    row: RowState,
    index: number,
    allRows: RowState[],
    tickets: string[],
    savings: number,
  ): RowState => {
    if (row.concept === 'Abono Ahorro') return { ...row, amount: savings, ticketNumber: undefined }
    if (row.concept === 'Pago Boleta') {
      const first = availableTicketsFor(allRows, index, tickets)[0]
      return { ...row, ticketNumber: first || undefined, amount: TICKET_PRICE }
    }
    return { ...row, amount: 0, ticketNumber: undefined }
  }

  const updateRow = (index: number, p: Partial<RowState>) =>
    setRows((list) => list.map((r, i) => (i === index ? { ...r, ...p } : r)))

  const changeConcept = (index: number, concept: string) =>
    setRows((list) => {
      const next = list.map((r, i) => (i === index ? { ...r, concept } : r))
      const target = next[index]
      if (target) next[index] = applyConcept(target, index, next, partnerTickets, partnerSavings)
      return next
    })

  const changePartner = (id: number) => {
    setPartnerId(id)
    const p = partners.find((x) => x.id === id)
    const tickets = parseTickets(p?.ticket)
    const savings = Number(p?.savingsValue || 0)
    setRows((list) => {
      const next = [...list]
      next.forEach((r, i) => {
        next[i] = applyConcept(r, i, next, tickets, savings)
      })
      return next
    })
  }

  const openCreate = () => {
    setModalError('')
    const first = partners[0]
    setPartnerId(first?.id || 0)
    setRows([defaultRow(Number(first?.savingsValue || 0))])
    setShowModal(true)
  }

  const subtotal = rows.reduce((acc, r) => acc + Number(r.amount || 0), 0)
  const totalFines = rows.reduce((acc, r) => acc + (r.hasFine ? Number(r.fineAmount || 0) : 0), 0)

  const submit = async () => {
    setModalError('')
    if (!partnerId) {
      setModalError('Debes seleccionar un socio.')
      return
    }
    if (!user) return

    for (const r of rows) {
      if (!r.amount || Number(r.amount) <= 0) {
        setModalError(`El concepto "${r.concept}" debe tener un valor mayor a cero.`)
        return
      }
      if (r.concept === 'Pago Boleta' && !r.ticketNumber) {
        setModalError('Debes seleccionar a qué número de boleta corresponde el pago.')
        return
      }
      if (!isValidDate(r.paymentDate)) {
        setModalError('La fecha debe tener el formato AAAA-MM-DD.')
        return
      }
    }

    setIsSaving(true)
    try {
      await createPayments({
        partnerId,
        registeredBy: user.id,
        items: rows.map((r) => ({
          concept: r.concept,
          ticketNumber: r.concept === 'Pago Boleta' ? (r.ticketNumber ?? null) : null,
          amount: Number(r.amount),
          paymentMethod: r.paymentMethod,
          paymentDate: r.paymentDate,
          observations: r.observations,
          hasFine: r.hasFine,
          fineAmount: r.hasFine ? Number(r.fineAmount || 0) : 0,
        })),
      })
      setShowModal(false)
      await reloadPayments()
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Error al guardar los abonos.')
    } finally {
      setIsSaving(false)
    }
  }

  // ---------- Listado ----------
  const filtered = useMemo(() => {
    let list = payments
    if (methodFilter !== 'todos') list = list.filter((p) => p.paymentMethod === methodFilter)
    const q = search.toLowerCase().trim()
    if (q) {
      list = list.filter(
        (p) =>
          p.partnerName.toLowerCase().includes(q) ||
          String(p.partnerDocument).toLowerCase().includes(q) ||
          p.concept.toLowerCase().includes(q) ||
          (p.ticketNumber ? p.ticketNumber.includes(q) : false) ||
          p.registeredByName.toLowerCase().includes(q),
      )
    }
    return list
  }, [payments, methodFilter, search])

  const totalRecaudado = filtered.reduce((acc, p) => acc + Number(p.totalPaid), 0)
  const totalAbonos = filtered
    .filter((p) => p.concept === 'Abono Ahorro')
    .reduce((acc, p) => acc + Number(p.amount), 0)
  const totalBoletas = filtered
    .filter((p) => p.concept === 'Pago Boleta')
    .reduce((acc, p) => acc + Number(p.amount), 0)
  const totalMultas = filtered.reduce((acc, p) => acc + Number(p.fineAmount || 0), 0)

  const header = (
    <View>
      <ScreenTitle title="Control de Pagos y Multas" subtitle="Registro de abonos, boletas y multas." />
      <ErrorBox message={error} />
      <StatCard
        label="Total recaudado"
        value={formatCurrency(totalRecaudado)}
        desc={`${filtered.length} movimientos`}
        style={{ flex: 0, marginBottom: 10 }}
      />
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        <StatCard label="Abonos ahorro" value={formatCurrency(totalAbonos)} tone="green" />
        <StatCard label="Boletas" value={formatCurrency(totalBoletas)} />
        <StatCard label="Multas" value={formatCurrency(totalMultas)} tone="orange" />
      </View>
      <Button title="+ Registrar pago" onPress={openCreate} style={{ marginBottom: 14 }} />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Buscar socio, concepto, boleta..." />
      <Segmented<'todos' | PaymentMethod>
        value={methodFilter}
        onChange={setMethodFilter}
        options={[
          { value: 'todos', label: 'Todos' },
          { value: 'efectivo', label: 'Efectivo' },
          { value: 'transferencia', label: 'Transferencia' },
        ]}
      />
    </View>
  )

  const reload = useCallback(async () => {
    await reloadPayments()
  }, [reloadPayments])

  return (
    <>
      <FlatList
        data={filtered}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={listContent(insets.bottom)}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.secondary} />}
        ListHeaderComponent={header}
        ListEmptyComponent={loading ? <Loading /> : <Empty text="No hay pagos registrados." />}
        renderItem={({ item: p }) => (
          <Card style={{ padding: 12 }}>
            <View style={s.top}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{p.partnerName}</Text>
                <Text style={s.muted}>
                  C.C. {p.partnerDocument} · {formatDate(p.paymentDate)}
                </Text>
              </View>
              <Badge text={p.paymentMethod.toUpperCase()} tone={p.paymentMethod === 'efectivo' ? 'green' : 'navy'} />
            </View>
            <InfoRow
              label="Concepto"
              value={p.ticketNumber ? `${p.concept} (#${p.ticketNumber})` : p.concept}
            />
            <InfoRow label="Valor" value={formatCurrency(p.amount)} />
            {Number(p.fineAmount) > 0 ? (
              <InfoRow
                label="Multa"
                value={<Text style={{ color: colors.warning, fontWeight: '700', fontSize: 13 }}>{formatCurrency(p.fineAmount)}</Text>}
              />
            ) : null}
            <InfoRow
              label="Total pagado"
              value={<Text style={{ fontWeight: '800', color: colors.primary, fontSize: 14 }}>{formatCurrency(p.totalPaid)}</Text>}
            />
            <Text style={[s.muted, { marginTop: 4 }]}>Registró: {p.registeredByName}</Text>
            {p.observations ? <Text style={[s.muted, { marginTop: 2 }]}>Obs.: {p.observations}</Text> : null}
          </Card>
        )}
      />

      <Sheet
        visible={showModal}
        title="Registrar pago"
        onClose={() => setShowModal(false)}
        footer={
          <View>
            <View style={s.totals}>
              <Text style={s.muted}>Subtotal: {formatCurrency(subtotal)}</Text>
              <Text style={s.muted}>Multas: {formatCurrency(totalFines)}</Text>
              <Text style={s.totalText}>Total: {formatCurrency(subtotal + totalFines)}</Text>
            </View>
            <Button title="Guardar abonos" onPress={submit} loading={isSaving} />
          </View>
        }
      >
        <ErrorBox message={modalError} />

        <SelectField<number>
          label="Socio"
          value={partnerId || null}
          onChange={changePartner}
          options={partners.map((p) => ({ value: p.id, label: `${p.fullName} - ${p.documentId}` }))}
          placeholder="Seleccionar socio"
        />

        {rows.map((r, index) => {
          const available = availableTicketsFor(rows, index, partnerTickets)
          const ticketOptions = [
            ...(r.ticketNumber && !available.includes(r.ticketNumber) ? [r.ticketNumber] : []),
            ...available,
          ]
          return (
            <View key={r.key} style={s.rowBox}>
              <View style={s.rowHeader}>
                <Text style={s.rowTitle}>Concepto {index + 1}</Text>
                {rows.length > 1 ? (
                  <Button
                    title="Quitar"
                    variant="ghost"
                    small
                    onPress={() => setRows((list) => list.filter((_, i) => i !== index))}
                  />
                ) : null}
              </View>

              <SelectField<string>
                label="Concepto"
                value={r.concept}
                onChange={(v) => changeConcept(index, v)}
                options={CONCEPTS.map((c) => ({ value: c, label: c }))}
              />

              {r.concept === 'Pago Boleta' ? (
                <SelectField<string>
                  label="Número de boleta"
                  value={r.ticketNumber ?? null}
                  onChange={(v) => updateRow(index, { ticketNumber: v, amount: TICKET_PRICE })}
                  options={ticketOptions.map((t) => ({ value: t, label: t }))}
                  placeholder={partnerTickets.length ? 'Seleccionar boleta' : 'El socio no tiene boletas'}
                />
              ) : null}

              <MoneyField label="Valor" value={r.amount} onChange={(n) => updateRow(index, { amount: n })} />

              <Segmented<PaymentMethod>
                label="Medio de pago"
                value={r.paymentMethod}
                onChange={(v) => updateRow(index, { paymentMethod: v })}
                options={[
                  { value: 'efectivo', label: 'Efectivo' },
                  { value: 'transferencia', label: 'Transferencia' },
                ]}
              />

              <Field
                label="Fecha (AAAA-MM-DD)"
                value={r.paymentDate}
                onChangeText={(t) => updateRow(index, { paymentDate: t })}
                placeholder="2026-10-22"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />

              <View style={s.switchRow}>
                <Text style={[s.label, { flex: 1, marginBottom: 0 }]}>¿Incluye multa?</Text>
                <Switch
                  value={r.hasFine}
                  onValueChange={(v) => updateRow(index, { hasFine: v })}
                  trackColor={{ true: colors.secondary }}
                />
              </View>
              {r.hasFine ? (
                <MoneyField label="Valor de la multa" value={r.fineAmount} onChange={(n) => updateRow(index, { fineAmount: n })} />
              ) : null}

              <Field
                label="Observaciones"
                value={r.observations}
                onChangeText={(t) => updateRow(index, { observations: t })}
                placeholder="Opcional"
                autoCapitalize="sentences"
              />
            </View>
          )
        })}

        <Button
          title="+ Añadir otro concepto"
          variant="outline"
          onPress={() => setRows((list) => [...list, defaultRow(partnerSavings)])}
          style={{ marginBottom: 8 }}
        />
      </Sheet>
    </>
  )
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  name: { fontSize: 15, fontWeight: '700', color: colors.primary },
  muted: { fontSize: 12, color: colors.muted },
  label: { fontSize: 13, fontWeight: '600', color: colors.primary },
  rowBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    backgroundColor: colors.bgLight,
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  rowTitle: { fontWeight: '800', color: colors.primary },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  totals: { marginBottom: 10, gap: 2 },
  totalText: { fontSize: 18, fontWeight: '800', color: colors.primary },
})

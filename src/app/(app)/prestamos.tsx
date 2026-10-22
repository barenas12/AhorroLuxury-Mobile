import { useMemo, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ApiError } from '@/api/client'
import { createEgress, createLoan, getActivePartners, getLoans, payLoan } from '@/api/services'
import type { LoanRecord, PartnerOption, PaymentMethod } from '@/api/types'
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
import { addDays, formatCurrency, formatDate, isValidDate, todayISO } from '@/utils/format'

type StatusFilter = 'Activo' | 'Pagado' | 'Todos'

const EMPTY_LOANS: LoanRecord[] = []
const EMPTY_PARTNERS: PartnerOption[] = []
const DEFAULT_TERM = 30

const statusTone = (status: LoanRecord['status']) =>
  status === 'Pagado' ? 'green' : status === 'En mora' ? 'red' : status === 'Anulado' ? 'gray' : 'navy'

export default function PrestamosScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()

  const { data: loans, loading, error, reload } = useFetch(getLoans, EMPTY_LOANS)
  const { data: partners } = useFetch(getActivePartners, EMPTY_PARTNERS)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Activo')

  // ---- Modal: nuevo préstamo ----
  const [showCreate, setShowCreate] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [modalError, setModalError] = useState('')
  const [form, setForm] = useState({
    partnerId: 0,
    initialCapital: 0,
    interestRate: '7',
    deliveryMethod: 'transferencia' as PaymentMethod,
    guarantee: 'Oro',
    deliveryDate: todayISO(),
    termDays: String(DEFAULT_TERM),
    installments: '1',
    observations: '',
  })
  const patch = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }))
  const dueDate = addDays(form.deliveryDate, Number(form.termDays))

  // ---- Modal: abono ----
  const [showPay, setShowPay] = useState(false)
  const [selectedLoan, setSelectedLoan] = useState<LoanRecord | null>(null)
  const [pay, setPay] = useState({
    capitalEfectivo: 0,
    capitalTransferencia: 0,
    interesEfectivo: 0,
    interesTransferencia: 0,
    paymentDate: todayISO(),
    observations: '',
  })
  const patchPay = (p: Partial<typeof pay>) => setPay((f) => ({ ...f, ...p }))

  // El usuario en sesión no aparece como beneficiario (igual que la web)
  const availablePartners = useMemo(
    () => partners.filter((p) => String(p.documentId) !== String(user?.user ?? '')),
    [partners, user],
  )

  const filtered = useMemo(() => {
    let list = loans
    if (statusFilter !== 'Todos') list = list.filter((l) => l.status === statusFilter)
    const q = search.toLowerCase().trim()
    if (q) {
      list = list.filter(
        (l) => l.partnerName.toLowerCase().includes(q) || String(l.documentId).includes(q),
      )
    }
    return list
  }, [loans, statusFilter, search])

  const totalPrestado = loans.reduce((acc, l) => acc + Number(l.initialCapital), 0)
  const totalEnCalle = loans.reduce((acc, l) => acc + (Number(l.initialCapital) - Number(l.paidCapital)), 0)
  const totalGanancia = loans.reduce((acc, l) => acc + Number(l.paidInterest), 0)

  // ---------- Crear préstamo ----------
  const openCreate = () => {
    setModalError('')
    setForm({
      partnerId: availablePartners[0]?.id || 0,
      initialCapital: 0,
      interestRate: '7',
      deliveryMethod: 'transferencia',
      guarantee: 'Oro',
      deliveryDate: todayISO(),
      termDays: String(DEFAULT_TERM),
      installments: '1',
      observations: '',
    })
    setShowCreate(true)
  }

  const submitLoan = async () => {
    setModalError('')
    if (!user) return
    if (!form.partnerId || form.initialCapital <= 0) {
      setModalError('Selecciona un socio y digita un capital mayor a 0.')
      return
    }
    if (!isValidDate(form.deliveryDate)) {
      setModalError('La fecha de entrega debe tener el formato AAAA-MM-DD.')
      return
    }
    if (!Number(form.termDays) || !dueDate) {
      setModalError('Indica un plazo válido en días.')
      return
    }

    const partner = availablePartners.find((p) => p.id === form.partnerId)
    setIsSaving(true)
    try {
      // 1. El egreso valida fondos en caja y descuenta el dinero entregado
      await createEgress({
        concept: `Préstamo Entregado - C.C. ${partner?.documentId}`,
        amount: form.initialCapital,
        paymentMethod: form.deliveryMethod,
        recipient: partner?.fullName ?? '',
        paymentDate: form.deliveryDate,
        observations: `Garantía: ${form.guarantee}`,
        registeredBy: user.id,
      })

      // 2. Si hubo fondos, se crea el contrato del préstamo
      await createLoan({
        partnerId: form.partnerId,
        initialCapital: form.initialCapital,
        interestRate: Number(form.interestRate) || 0,
        deliveryMethod: form.deliveryMethod,
        guarantee: form.guarantee,
        deliveryDate: form.deliveryDate,
        termDays: Number(form.termDays),
        dueDate,
        installments: Number(form.installments) || 1,
        observations: form.observations,
        registeredBy: user.id,
      })

      setShowCreate(false)
      await reload()
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Error al registrar el préstamo.')
    } finally {
      setIsSaving(false)
    }
  }

  // ---------- Abono ----------
  const openPay = (loan: LoanRecord) => {
    setModalError('')
    setSelectedLoan(loan)
    setPay({
      capitalEfectivo: 0,
      capitalTransferencia: 0,
      interesEfectivo: 0,
      interesTransferencia: 0,
      paymentDate: todayISO(),
      observations: '',
    })
    setShowPay(true)
  }

  const remainingCapital = selectedLoan
    ? Number(selectedLoan.initialCapital) - Number(selectedLoan.paidCapital)
    : 0
  const remainingInterest = selectedLoan
    ? Math.max(
        0,
        Number(selectedLoan.initialCapital) *
          (Number(selectedLoan.interestRate) / 100) *
          Number(selectedLoan.installments) -
          Number(selectedLoan.paidInterest),
      )
    : 0
  const abonoCapital = pay.capitalEfectivo + pay.capitalTransferencia
  const abonoInteres = pay.interesEfectivo + pay.interesTransferencia
  const abonoTotal = abonoCapital + abonoInteres

  const submitPay = async () => {
    setModalError('')
    if (!selectedLoan || !user) return
    if (abonoTotal <= 0) {
      setModalError('El total a pagar debe ser mayor a 0.')
      return
    }
    if (abonoCapital > remainingCapital) {
      setModalError('El abono a capital no puede superar el saldo pendiente.')
      return
    }
    if (!isValidDate(pay.paymentDate)) {
      setModalError('La fecha debe tener el formato AAAA-MM-DD.')
      return
    }

    setIsSaving(true)
    try {
      await payLoan(selectedLoan.id, { ...pay, registeredBy: user.id })
      setShowPay(false)
      await reload()
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Error al registrar el abono.')
    } finally {
      setIsSaving(false)
    }
  }

  const header = (
    <View>
      <ScreenTitle title="Préstamos y Respaldos" subtitle="Capital prestado, intereses y pagos mixtos." />
      <ErrorBox message={error} />
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
        <StatCard label="Prestado" value={formatCurrency(totalPrestado)} />
        <StatCard label="En la calle" value={formatCurrency(totalEnCalle)} tone="orange" />
      </View>
      <StatCard
        label="Ganancia neta (intereses)"
        value={formatCurrency(totalGanancia)}
        tone="green"
        style={{ flex: 0, marginBottom: 14 }}
      />
      <Button title="+ Entregar préstamo" onPress={openCreate} style={{ marginBottom: 14 }} />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Buscar por socio o documento" />
      <Segmented<StatusFilter>
        value={statusFilter}
        onChange={setStatusFilter}
        options={[
          { value: 'Activo', label: 'Activos' },
          { value: 'Pagado', label: 'Pagados' },
          { value: 'Todos', label: 'Todos' },
        ]}
      />
    </View>
  )

  return (
    <>
      <FlatList
        data={filtered}
        keyExtractor={(l) => String(l.id)}
        contentContainerStyle={listContent(insets.bottom)}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.secondary} />}
        ListHeaderComponent={header}
        ListEmptyComponent={loading ? <Loading /> : <Empty text="No hay préstamos en esta vista." />}
        renderItem={({ item: l }) => {
          const pending = Number(l.initialCapital) - Number(l.paidCapital)
          const canPay = l.status !== 'Pagado' && l.status !== 'Anulado'
          return (
            <Card>
              <View style={s.top}>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{l.partnerName}</Text>
                  <Text style={s.muted}>C.C. {l.documentId}</Text>
                </View>
                <Badge text={l.status} tone={statusTone(l.status)} />
              </View>

              <InfoRow label="Capital prestado" value={formatCurrency(l.initialCapital)} />
              <InfoRow label="Interés" value={`${l.interestRate}% · ${l.installments} cuota(s)`} />
              <InfoRow label="Capital abonado" value={formatCurrency(l.paidCapital)} />
              <InfoRow
                label="Saldo capital"
                value={<Text style={{ fontWeight: '800', color: pending > 0 ? colors.danger : colors.secondary, fontSize: 13 }}>{formatCurrency(pending)}</Text>}
              />
              <InfoRow label="Intereses pagados" value={formatCurrency(l.paidInterest)} />
              <InfoRow label="Entrega" value={`${formatDate(l.deliveryDate)} (${l.deliveryMethod})`} />
              <InfoRow label="Vence" value={`${formatDate(l.dueDate)} · ${l.termDays} días`} />
              <InfoRow label="Garantía" value={l.guarantee} />
              {l.observations ? <Text style={[s.muted, { marginTop: 4 }]}>Obs.: {l.observations}</Text> : null}
              <Text style={[s.muted, { marginTop: 2 }]}>Registró: {l.registeredByName}</Text>

              {canPay ? (
                <Button title="Registrar abono" small onPress={() => openPay(l)} style={{ marginTop: 12 }} />
              ) : null}
            </Card>
          )
        }}
      />

      {/* ----- Nuevo préstamo ----- */}
      <Sheet
        visible={showCreate}
        title="Entregar préstamo"
        onClose={() => setShowCreate(false)}
        footer={<Button title="Registrar préstamo" onPress={submitLoan} loading={isSaving} />}
      >
        <ErrorBox message={modalError} />

        <SelectField<number>
          label="Socio"
          value={form.partnerId || null}
          onChange={(v) => patch({ partnerId: v })}
          options={availablePartners.map((p) => ({ value: p.id, label: `${p.fullName} - ${p.documentId}` }))}
          placeholder="Seleccionar socio"
        />
        <MoneyField label="Capital a prestar" value={form.initialCapital} onChange={(n) => patch({ initialCapital: n })} />
        <Field
          label="Tasa de interés (%)"
          value={form.interestRate}
          onChangeText={(t) => patch({ interestRate: t.replace(',', '.') })}
          keyboardType="decimal-pad"
        />
        <Segmented<PaymentMethod>
          label="Método de entrega"
          value={form.deliveryMethod}
          onChange={(v) => patch({ deliveryMethod: v })}
          options={[
            { value: 'transferencia', label: 'Transferencia / Nequi' },
            { value: 'efectivo', label: 'Efectivo' },
          ]}
        />
        <Segmented<string>
          label="Garantía"
          value={form.guarantee}
          onChange={(v) => patch({ guarantee: v })}
          options={[
            { value: 'Oro', label: 'Oro' },
            { value: 'Prenda', label: 'Prenda' },
            { value: 'Sin Prenda', label: 'Sin prenda' },
          ]}
        />
        <Field
          label="Fecha de entrega (AAAA-MM-DD)"
          value={form.deliveryDate}
          onChangeText={(t) => patch({ deliveryDate: t })}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
        <Field
          label="Plazo (días)"
          value={form.termDays}
          onChangeText={(t) => patch({ termDays: t.replace(/\D/g, '') })}
          keyboardType="number-pad"
          hint={dueDate ? `Fecha límite: ${dueDate}` : 'Ingresa la fecha de entrega y el plazo'}
        />
        <Field
          label="Número de cuotas"
          value={form.installments}
          onChangeText={(t) => patch({ installments: t.replace(/\D/g, '') })}
          keyboardType="number-pad"
        />
        <Field
          label="Observaciones"
          value={form.observations}
          onChangeText={(t) => patch({ observations: t })}
          placeholder="Opcional"
          autoCapitalize="sentences"
          multiline
        />
        <Text style={s.note}>
          Al registrar, se descuenta primero el dinero de la caja (egreso). Si no hay fondos suficientes, el
          préstamo no se crea.
        </Text>
      </Sheet>

      {/* ----- Abono ----- */}
      <Sheet
        visible={showPay}
        title={selectedLoan ? `Abono · ${selectedLoan.partnerName}` : 'Abono'}
        onClose={() => setShowPay(false)}
        footer={
          <View>
            <Text style={s.totalText}>Total del abono: {formatCurrency(abonoTotal)}</Text>
            <Button title="Registrar abono" onPress={submitPay} loading={isSaving} />
          </View>
        }
      >
        <ErrorBox message={modalError} />

        <Card style={{ backgroundColor: colors.bgLight, shadowOpacity: 0, elevation: 0 }}>
          <InfoRow label="Saldo de capital" value={formatCurrency(remainingCapital)} />
          <InfoRow label="Interés pendiente" value={formatCurrency(remainingInterest)} />
        </Card>

        <Text style={s.section}>Abono a capital</Text>
        <MoneyField label="En efectivo" value={pay.capitalEfectivo} onChange={(n) => patchPay({ capitalEfectivo: n })} />
        <MoneyField label="Por transferencia" value={pay.capitalTransferencia} onChange={(n) => patchPay({ capitalTransferencia: n })} />

        <Text style={s.section}>Abono a intereses</Text>
        <MoneyField label="En efectivo" value={pay.interesEfectivo} onChange={(n) => patchPay({ interesEfectivo: n })} />
        <MoneyField label="Por transferencia" value={pay.interesTransferencia} onChange={(n) => patchPay({ interesTransferencia: n })} />

        <Field
          label="Fecha del pago (AAAA-MM-DD)"
          value={pay.paymentDate}
          onChangeText={(t) => patchPay({ paymentDate: t })}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
        <Field
          label="Observaciones"
          value={pay.observations}
          onChangeText={(t) => patchPay({ observations: t })}
          placeholder="Opcional"
          autoCapitalize="sentences"
        />
      </Sheet>
    </>
  )
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  name: { fontSize: 16, fontWeight: '700', color: colors.primary },
  muted: { fontSize: 12, color: colors.muted },
  section: { fontSize: 14, fontWeight: '800', color: colors.primary, marginBottom: 8 },
  totalText: { fontSize: 18, fontWeight: '800', color: colors.primary, marginBottom: 10 },
  note: { fontSize: 12, color: colors.muted, marginBottom: 8 },
})

import { useMemo, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ApiError } from '@/api/client'
import { createEgress, getEgresses, getUsers } from '@/api/services'
import type { EgressRecord, PartnerUser, PaymentMethod } from '@/api/types'
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
  Segmented,
  SelectField,
  Sheet,
  StatCard,
  listContent,
} from '@/components/ui'
import { useFetch } from '@/hooks/useFetch'
import { colors } from '@/theme'
import { formatCurrency, formatDate, isValidDate, todayISO } from '@/utils/format'

const CONCEPTS = ['Préstamo Entregado', 'Pago Premio', 'Descapitalización', 'Otros']
const EMPTY_EGRESSES: EgressRecord[] = []
const EMPTY_USERS: PartnerUser[] = []

export default function EgresosScreen() {
  const insets = useSafeAreaInsets()
  const { user } = useAuth()

  const { data: egresses, loading, error, reload } = useFetch(getEgresses, EMPTY_EGRESSES)
  const { data: users } = useFetch(getUsers, EMPTY_USERS)

  const activePartners = useMemo(() => users.filter((u) => u.partnerStatus === 1), [users])

  const [showModal, setShowModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [modalError, setModalError] = useState('')
  const [form, setForm] = useState({
    concept: 'Préstamo Entregado',
    amount: 0,
    paymentMethod: 'efectivo' as PaymentMethod,
    recipient: '',
    paymentDate: todayISO(),
    observations: '',
  })
  const patch = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }))

  const totalEfectivo = egresses
    .filter((e) => e.paymentMethod === 'efectivo')
    .reduce((acc, e) => acc + Number(e.amount), 0)
  const totalTransferencia = egresses
    .filter((e) => e.paymentMethod === 'transferencia')
    .reduce((acc, e) => acc + Number(e.amount), 0)

  const openModal = () => {
    setModalError('')
    setForm({
      concept: 'Préstamo Entregado',
      amount: 0,
      paymentMethod: 'efectivo',
      recipient: '',
      paymentDate: todayISO(),
      observations: '',
    })
    setShowModal(true)
  }

  const submit = async () => {
    setModalError('')
    if (!user) return
    if (form.amount <= 0) {
      setModalError('El valor del egreso debe ser mayor a 0.')
      return
    }
    if (!form.recipient.trim()) {
      setModalError('Debes especificar a quién se le entrega el dinero.')
      return
    }
    if (!isValidDate(form.paymentDate)) {
      setModalError('La fecha debe tener el formato AAAA-MM-DD.')
      return
    }

    setIsSaving(true)
    try {
      await createEgress({ ...form, recipient: form.recipient.trim(), registeredBy: user.id })
      setShowModal(false)
      await reload()
    } catch (err) {
      // Aquí aparece el mensaje de "Fondos insuficientes" del backend
      setModalError(err instanceof ApiError ? err.message : 'Error al registrar el egreso.')
    } finally {
      setIsSaving(false)
    }
  }

  const header = (
    <View>
      <ScreenTitle title="Control de Egresos" subtitle="Salidas de dinero de la caja." />
      <ErrorBox message={error} />
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        <StatCard label="Egresos en efectivo" value={formatCurrency(totalEfectivo)} tone="orange" />
        <StatCard label="Egresos banco" value={formatCurrency(totalTransferencia)} tone="red" />
      </View>
      <Button title="+ Registrar egreso" onPress={openModal} style={{ marginBottom: 14 }} />
    </View>
  )

  return (
    <>
      <FlatList
        data={egresses}
        keyExtractor={(e) => String(e.id)}
        contentContainerStyle={listContent(insets.bottom)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.secondary} />}
        ListHeaderComponent={header}
        ListEmptyComponent={loading ? <Loading /> : <Empty text="No hay egresos registrados." />}
        renderItem={({ item: e }) => (
          <Card style={{ padding: 12 }}>
            <View style={s.top}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{e.concept}</Text>
                <Text style={s.muted}>{formatDate(e.paymentDate)}</Text>
              </View>
              <Badge text={e.paymentMethod.toUpperCase()} tone={e.paymentMethod === 'efectivo' ? 'green' : 'navy'} />
            </View>
            <InfoRow label="Beneficiario" value={e.recipient} />
            <InfoRow
              label="Valor"
              value={<Text style={{ fontWeight: '800', color: colors.danger, fontSize: 14 }}>{formatCurrency(e.amount)}</Text>}
            />
            {e.observations ? <Text style={[s.muted, { marginTop: 4 }]}>Obs.: {e.observations}</Text> : null}
            <Text style={[s.muted, { marginTop: 2 }]}>Registró: {e.registeredByName}</Text>
          </Card>
        )}
      />

      <Sheet
        visible={showModal}
        title="Registrar egreso"
        onClose={() => setShowModal(false)}
        footer={<Button title="Guardar egreso" onPress={submit} loading={isSaving} />}
      >
        <ErrorBox message={modalError} />

        <SelectField<string>
          label="Concepto"
          value={form.concept}
          onChange={(v) => patch({ concept: v, recipient: '' })}
          options={CONCEPTS.map((c) => ({ value: c, label: c }))}
        />

        {form.concept !== 'Otros' ? (
          <SelectField<string>
            label="Socio beneficiario"
            value={form.recipient || null}
            onChange={(v) => patch({ recipient: v })}
            options={activePartners.map((p) => ({ value: p.fullName, label: p.fullName }))}
            placeholder="Seleccione un socio"
          />
        ) : (
          <Field
            label="Beneficiario"
            value={form.recipient}
            onChangeText={(t) => patch({ recipient: t })}
            placeholder="¿A quién se le entrega el dinero?"
            autoCapitalize="words"
          />
        )}

        <MoneyField label="Valor" value={form.amount} onChange={(n) => patch({ amount: n })} />

        <Segmented<PaymentMethod>
          label="Medio de pago"
          value={form.paymentMethod}
          onChange={(v) => patch({ paymentMethod: v })}
          options={[
            { value: 'efectivo', label: 'Efectivo' },
            { value: 'transferencia', label: 'Transferencia' },
          ]}
        />

        <Field
          label="Fecha (AAAA-MM-DD)"
          value={form.paymentDate}
          onChangeText={(t) => patch({ paymentDate: t })}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
        <Field
          label="Observaciones"
          value={form.observations}
          onChangeText={(t) => patch({ observations: t })}
          placeholder="Opcional"
          autoCapitalize="sentences"
          multiline
        />
      </Sheet>
    </>
  )
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  name: { fontSize: 15, fontWeight: '700', color: colors.primary },
  muted: { fontSize: 12, color: colors.muted },
})

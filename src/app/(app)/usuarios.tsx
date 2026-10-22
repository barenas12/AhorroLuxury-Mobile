import { useCallback, useMemo, useState } from 'react'
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ApiError } from '@/api/client'
import {
  createUser,
  getCoordinators,
  getUsers,
  resetUserPassword,
  setPartnerStatus,
  updateUser,
} from '@/api/services'
import type { CoordinatorOption, PartnerUser, UserFormPayload } from '@/api/types'
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
  SelectField,
  Segmented,
  Sheet,
  StatCard,
  listContent,
} from '@/components/ui'
import { useFetch } from '@/hooks/useFetch'
import { colors } from '@/theme'
import { formatCurrency, parseTickets, roleLabel } from '@/utils/format'

type StatusFilter = 'todos' | 'activos' | 'inactivos'

interface FormState {
  id: number
  documentId: string
  name: string
  lastName: string
  savingsValue: number
  frequency: number
  cellphone: string
  coordinator: number
  profile: number
  canLogin: boolean
  ticket: string[]
  ticket2: string[]
}

const EMPTY_USERS: PartnerUser[] = []
const EMPTY_COORDS: CoordinatorOption[] = []

const newForm = (coordinator: number): FormState => ({
  id: 0,
  documentId: '',
  name: '',
  lastName: '',
  savingsValue: 50000,
  frequency: 8,
  cellphone: '',
  coordinator,
  profile: 3,
  canLogin: true,
  ticket: [],
  ticket2: [],
})

const frequencyLabel = (days: number) =>
  days === 8 ? 'Semanal (8 d)' : days === 15 ? 'Quincenal (15 d)' : days === 30 ? 'Mensual (30 d)' : `${days} días`

// ---------------- Editor de boletas (00-99) ----------------
function TicketEditor({
  label,
  tickets,
  onChange,
  onError,
}: {
  label: string
  tickets: string[]
  onChange: (t: string[]) => void
  onError: (msg: string) => void
}) {
  const [input, setInput] = useState('')

  const add = () => {
    onError('')
    const raw = input.trim()
    if (!raw) return
    const num = parseInt(raw, 10)
    if (isNaN(num) || num < 0 || num > 99) {
      onError(`El número de ${label} debe estar entre 00 y 99.`)
      return
    }
    const formatted = num.toString().padStart(2, '0')
    if (tickets.includes(formatted)) {
      onError(`El número ${formatted} ya está agregado en ${label}.`)
      return
    }
    onChange([...tickets, formatted].sort((a, b) => parseInt(a, 10) - parseInt(b, 10)))
    setInput('')
  }

  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>Boletas {label}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Field
          style={{ flex: 1, marginBottom: 0 }}
          value={input}
          onChangeText={setInput}
          placeholder="00 - 99"
          keyboardType="number-pad"
          maxLength={2}
          onSubmitEditing={add}
        />
        <Button title="Añadir" small onPress={add} style={{ alignSelf: 'center' }} />
      </View>
      <View style={s.chips}>
        {tickets.length === 0 ? <Text style={s.muted}>Sin boletas asignadas</Text> : null}
        {tickets.map((t) => (
          <Pressable key={t} onPress={() => onChange(tickets.filter((x) => x !== t))} style={s.chip}>
            <Text style={s.chipText}>{t} ✕</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

export default function UsuariosScreen() {
  const insets = useSafeAreaInsets()

  const { data: users, loading, error, reload } = useFetch(getUsers, EMPTY_USERS)
  const { data: coordinators } = useFetch(getCoordinators, EMPTY_COORDS)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')

  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [modalError, setModalError] = useState('')
  const [form, setForm] = useState<FormState>(newForm(0))

  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }))

  const uniqueUsers = useMemo(() => {
    const seen = new Set<number>()
    return users.filter((user) => {
      if (seen.has(user.id)) return false
      seen.add(user.id)
      return true
    })
  }, [users])

  const filtered = useMemo(() => {
    let list = uniqueUsers
    if (statusFilter === 'activos') list = list.filter((u) => u.partnerStatus === 1)
    else if (statusFilter === 'inactivos') list = list.filter((u) => u.partnerStatus === 0)

    const q = search.toLowerCase().trim()
    if (q) {
      list = list.filter(
        (u) =>
          u.fullName.toLowerCase().includes(q) ||
          String(u.documentId).toLowerCase().includes(q) ||
          u.coordinatorName.toLowerCase().includes(q) ||
          parseTickets(u.ticket).some((t) => t.includes(q)) ||
          parseTickets(u.ticket2).some((t) => t.includes(q)),
      )
    }
    return list
  }, [uniqueUsers, search, statusFilter])

  const totalActivos = uniqueUsers.filter((u) => u.partnerStatus === 1).length
  const totalInactivos = uniqueUsers.filter((u) => u.partnerStatus === 0).length

  const openCreate = () => {
    setIsEditing(false)
    setModalError('')
    setForm(newForm(coordinators[0]?.id || 0))
    setShowModal(true)
  }

  const openEdit = (u: PartnerUser) => {
    setIsEditing(true)
    setModalError('')
    setForm({
      id: u.id,
      documentId: String(u.documentId),
      name: u.name,
      lastName: u.lastName,
      savingsValue: Number(u.savingsValue),
      frequency: Number(u.frequency) || 8,
      cellphone: String(u.cellphone ?? ''),
      coordinator: u.coordinator,
      profile: Number(u.profile),
      canLogin: u.userLoginStatus === 1,
      ticket: [...parseTickets(u.ticket)],
      ticket2: [...parseTickets(u.ticket2)],
    })
    setShowModal(true)
  }

  const submit = async () => {
    setModalError('')
    if (!form.documentId.trim() || !form.name.trim() || !form.lastName.trim()) {
      setModalError('Cédula, nombre y apellidos son campos obligatorios.')
      return
    }
    if (form.cellphone && isNaN(Number(form.cellphone))) {
      setModalError('El celular debe ser numérico.')
      return
    }

    const payload: UserFormPayload = {
      ...(isEditing ? { id: form.id } : {}),
      documentId: form.documentId.trim(),
      name: form.name.trim(),
      lastName: form.lastName.trim(),
      savingsValue: form.savingsValue,
      frequency: form.frequency,
      cellphone: Number(form.cellphone || 0),
      coordinator: form.coordinator,
      profile: form.profile,
      canLogin: form.canLogin,
      ticket: form.ticket,
      ticket2: form.ticket2,
    }

    setIsSaving(true)
    try {
      if (isEditing) await updateUser(payload)
      else await createUser(payload)
      setShowModal(false)
      await reload()
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Error al guardar socio.')
    } finally {
      setIsSaving(false)
    }
  }

  const toggleStatus = useCallback(
    async (u: PartnerUser) => {
      const newStatus = u.partnerStatus === 1 ? 0 : 1
      try {
        await setPartnerStatus(String(u.documentId), newStatus)
        await reload()
      } catch (err) {
        Alert.alert('Error', err instanceof ApiError ? err.message : 'No se pudo cambiar el estado.')
      }
    },
    [reload],
  )

  const confirmToggle = (u: PartnerUser) => {
    const action = u.partnerStatus === 1 ? 'desactivar' : 'activar'
    Alert.alert('Cambiar estado', `¿Deseas ${action} a ${u.fullName}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: () => toggleStatus(u) },
    ])
  }

  const confirmReset = (u: PartnerUser) => {
    Alert.alert(
      'Restablecer contraseña',
      `¿Restablecer la contraseña de ${u.fullName} a su documento de identidad?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restablecer',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetUserPassword(String(u.documentId))
              Alert.alert('Listo', `Contraseña de ${u.fullName} restablecida exitosamente.`)
              reload()
            } catch (err) {
              Alert.alert('Error', err instanceof ApiError ? err.message : 'No se pudo restablecer.')
            }
          },
        },
      ],
    )
  }

  const header = (
    <View>
      <ScreenTitle title="Gestión de Socios" subtitle="Alta, edición, estado y boletas de rifa." />
      <ErrorBox message={error} />
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
        <StatCard label="Activos" value={totalActivos} tone="green" />
        <StatCard label="Inactivos" value={totalInactivos} tone="red" />
      </View>
      <Button title="+ Nuevo socio" onPress={openCreate} style={{ marginBottom: 14 }} />
      <SearchBar value={search} onChangeText={setSearch} placeholder="Buscar nombre, documento, coordinador o boleta" />
      <Segmented<StatusFilter>
        value={statusFilter}
        onChange={setStatusFilter}
        options={[
          { value: 'todos', label: 'Todos' },
          { value: 'activos', label: 'Activos' },
          { value: 'inactivos', label: 'Inactivos' },
        ]}
      />
    </View>
  )

  return (
    <>
      <FlatList
        data={filtered}
        keyExtractor={(u) => String(u.id)}
        contentContainerStyle={listContent(insets.bottom)}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.secondary} />}
        ListHeaderComponent={header}
        ListEmptyComponent={loading ? <Loading /> : <Empty text="No se encontraron socios." />}
        renderItem={({ item: u }) => {
          const t1 = parseTickets(u.ticket)
          const t2 = parseTickets(u.ticket2)
          return (
            <Card>
              <View style={s.top}>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{u.fullName}</Text>
                  <Text style={s.muted}>C.C. {u.documentId}</Text>
                </View>
                <View style={{ gap: 4, alignItems: 'flex-end' }}>
                  <Badge text={u.partnerStatus === 1 ? 'Activo' : 'Inactivo'} tone={u.partnerStatus === 1 ? 'green' : 'red'} />
                  <Badge text={roleLabel(u.profile)} tone={Number(u.profile) === 3 ? 'gray' : 'navy'} />
                </View>
              </View>

              <InfoRow label="Ahorro" value={`${formatCurrency(u.savingsValue)} · ${frequencyLabel(Number(u.frequency))}`} />
              <InfoRow label="Celular" value={String(u.cellphone)} />
              <InfoRow label="Coordinador" value={u.coordinatorName} />
              <InfoRow label="Acceso al portal" value={u.userLoginStatus === 1 ? 'Habilitado' : 'Deshabilitado'} />
              {t1.length > 0 ? <InfoRow label="Rifa 1" value={t1.join(', ')} /> : null}
              {t2.length > 0 ? <InfoRow label="Rifa 2" value={t2.join(', ')} /> : null}

              <View style={s.actions}>
                <Button title="Editar" variant="outline" small onPress={() => openEdit(u)} style={{ flex: 1 }} />
                <Button
                  title={u.partnerStatus === 1 ? 'Desactivar' : 'Activar'}
                  variant="outline"
                  small
                  onPress={() => confirmToggle(u)}
                  style={{ flex: 1 }}
                />
                <Button title="Reset clave" variant="outline" small onPress={() => confirmReset(u)} style={{ flex: 1 }} />
              </View>
            </Card>
          )
        }}
      />

      <Sheet
        visible={showModal}
        title={isEditing ? 'Editar socio' : 'Nuevo socio'}
        onClose={() => setShowModal(false)}
        footer={<Button title={isEditing ? 'Guardar cambios' : 'Crear socio'} onPress={submit} loading={isSaving} />}
      >
        <ErrorBox message={modalError} />

        <Field label="Cédula" value={form.documentId} onChangeText={(t) => patch({ documentId: t })} keyboardType="number-pad" />
        <Field label="Nombres" value={form.name} onChangeText={(t) => patch({ name: t })} autoCapitalize="words" />
        <Field label="Apellidos" value={form.lastName} onChangeText={(t) => patch({ lastName: t })} autoCapitalize="words" />
        <Field label="Celular" value={form.cellphone} onChangeText={(t) => patch({ cellphone: t })} keyboardType="number-pad" />
        <MoneyField label="Valor de ahorro (mensual)" value={form.savingsValue} onChange={(n) => patch({ savingsValue: n })} />

        <Segmented<number>
          label="Frecuencia de ahorro"
          value={form.frequency}
          onChange={(v) => patch({ frequency: v })}
          options={[
            { value: 8, label: '8 días' },
            { value: 15, label: '15 días' },
            { value: 30, label: '30 días' },
          ]}
        />

        <SelectField<number>
          label="Coordinador"
          value={form.coordinator || null}
          onChange={(v) => patch({ coordinator: v })}
          options={coordinators.map((c) => ({ value: c.id, label: c.fullName }))}
          placeholder="Seleccionar coordinador"
        />

        <SelectField<number>
          label="Perfil"
          value={form.profile}
          onChange={(v) => patch({ profile: v })}
          options={[
            { value: 1, label: 'Administrador (1)' },
            { value: 2, label: 'Coordinador (2)' },
            { value: 3, label: 'Socio Ahorrador (3)' },
          ]}
        />

        <View style={s.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Puede iniciar sesión</Text>
            <Text style={s.muted}>Habilita el acceso al portal con su documento.</Text>
          </View>
          <Switch
            value={form.canLogin}
            onValueChange={(v) => patch({ canLogin: v })}
            trackColor={{ true: colors.secondary }}
          />
        </View>

        <TicketEditor label="Rifa 1" tickets={form.ticket} onChange={(t) => patch({ ticket: t })} onError={setModalError} />
        <TicketEditor label="Rifa 2" tickets={form.ticket2} onChange={(t) => patch({ ticket2: t })} onError={setModalError} />
      </Sheet>
    </>
  )
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  name: { fontSize: 16, fontWeight: '700', color: colors.primary },
  muted: { fontSize: 12, color: colors.muted },
  label: { fontSize: 13, fontWeight: '600', color: colors.primary, marginBottom: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' },
  chip: { backgroundColor: colors.successBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  chipText: { color: colors.secondary, fontWeight: '700', fontSize: 13 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
})

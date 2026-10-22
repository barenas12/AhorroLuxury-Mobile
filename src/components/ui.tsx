import React, { ReactNode, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors, radius, shadow } from '@/theme'
import { toNumber } from '@/utils/format'

// ------------------------------------------------------------------
// Card
// ------------------------------------------------------------------
export function Card({
  children,
  style,
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return <View style={[s.card, style]}>{children}</View>
}

// ------------------------------------------------------------------
// Button
// ------------------------------------------------------------------
type ButtonVariant = 'primary' | 'outline' | 'danger' | 'ghost'

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  small = false,
  style,
}: {
  title: string
  onPress: () => void
  variant?: ButtonVariant
  loading?: boolean
  disabled?: boolean
  small?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const isDisabled = disabled || loading
  const bg =
    variant === 'primary'
      ? colors.secondary
      : variant === 'danger'
        ? colors.danger
        : 'transparent'
  const border =
    variant === 'outline' ? colors.border : variant === 'danger' ? colors.danger : 'transparent'
  const textColor =
    variant === 'primary' || variant === 'danger'
      ? '#fff'
      : variant === 'outline'
        ? colors.primary
        : colors.muted

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        s.btn,
        small && s.btnSmall,
        { backgroundColor: bg, borderColor: border },
        isDisabled && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[s.btnText, small && { fontSize: 13 }, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  )
}

// ------------------------------------------------------------------
// Inputs
// ------------------------------------------------------------------
export function Field({
  label,
  hint,
  style,
  ...props
}: TextInputProps & { label?: string; hint?: string }) {
  return (
    <View style={[s.fieldWrap, style]}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        {...props}
        style={[s.input, props.multiline && { height: 80, textAlignVertical: 'top' }]}
      />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  )
}

/** Campo de dinero: el estado es un número; muestra vacío cuando es 0 */
export function MoneyField({
  label,
  value,
  onChange,
  hint,
  placeholder = '0',
}: {
  label?: string
  value: number
  onChange: (n: number) => void
  hint?: string
  placeholder?: string
}) {
  return (
    <Field
      label={label}
      hint={hint}
      value={value ? String(value) : ''}
      onChangeText={(t) => onChange(toNumber(t))}
      keyboardType="number-pad"
      placeholder={placeholder}
    />
  )
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Buscar...',
}: {
  value: string
  onChangeText: (t: string) => void
  placeholder?: string
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      autoCapitalize="none"
      autoCorrect={false}
      clearButtonMode="while-editing"
      style={[s.input, { backgroundColor: '#fff', marginBottom: 10 }]}
    />
  )
}

// ------------------------------------------------------------------
// Segmented (filtros / opciones cortas)
// ------------------------------------------------------------------
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  label?: string
}) {
  return (
    <View style={s.fieldWrap}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={s.segmented}>
        {options.map((o) => {
          const active = o.value === value
          return (
            <Pressable
              key={String(o.value)}
              onPress={() => onChange(o.value)}
              style={[s.segItem, active && s.segItemActive]}
            >
              <Text style={[s.segText, active && s.segTextActive]} numberOfLines={1}>
                {o.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

// ------------------------------------------------------------------
// SelectField (lista en modal)
// ------------------------------------------------------------------
export function SelectField<T extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Seleccionar...',
}: {
  label?: string
  value: T | null | undefined
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const insets = useSafeAreaInsets()
  const selected = options.find((o) => o.value === value)

  return (
    <View style={s.fieldWrap}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <Pressable style={[s.input, s.selectBox]} onPress={() => setOpen(true)}>
        <Text style={{ color: selected ? colors.text : colors.muted, flex: 1 }} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text style={{ color: colors.muted }}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.overlay} onPress={() => setOpen(false)}>
          <Pressable
            style={[s.pickerSheet, { paddingBottom: insets.bottom + 12 }]}
            onPress={() => {}}
          >
            <Text style={s.sheetTitle}>{label ?? 'Seleccionar'}</Text>
            <FlatList
              data={options}
              keyExtractor={(o) => String(o.value)}
              ListEmptyComponent={<Text style={s.emptyText}>No hay opciones disponibles.</Text>}
              renderItem={({ item }) => {
                const active = item.value === value
                return (
                  <Pressable
                    style={[s.pickerItem, active && { backgroundColor: colors.successBg }]}
                    onPress={() => {
                      onChange(item.value)
                      setOpen(false)
                    }}
                  >
                    <Text
                      style={{
                        color: active ? colors.secondary : colors.text,
                        fontWeight: active ? '700' : '400',
                      }}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                )
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}

// ------------------------------------------------------------------
// Sheet (modal de formulario a pantalla casi completa)
// ------------------------------------------------------------------
export function Sheet({
  visible,
  title,
  onClose,
  children,
  footer,
}: {
  visible: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.overlay}>
          <View style={[s.formSheet, { paddingBottom: insets.bottom + 12 }]}>
            <View style={s.sheetHeader}>
              <Text style={[s.sheetTitle, { marginBottom: 0, flex: 1 }]}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Text style={{ fontSize: 20, color: colors.muted }}>✕</Text>
              </Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
            {footer ? <View style={{ paddingTop: 12 }}>{footer}</View> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ------------------------------------------------------------------
// Badge / StatCard / mensajes
// ------------------------------------------------------------------
type Tone = 'green' | 'red' | 'orange' | 'gray' | 'navy'

const toneStyles: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: colors.successBg, fg: colors.secondary },
  red: { bg: colors.dangerBg, fg: colors.dangerText },
  orange: { bg: colors.warningBg, fg: colors.warning },
  gray: { bg: '#E2E8F0', fg: colors.textSoft },
  navy: { bg: 'rgba(8, 28, 45, 0.12)', fg: colors.primary },
}

export function Badge({ text, tone = 'gray' }: { text: string; tone?: Tone }) {
  const t = toneStyles[tone]
  return (
    <View style={[s.badge, { backgroundColor: t.bg }]}>
      <Text style={[s.badgeText, { color: t.fg }]}>{text}</Text>
    </View>
  )
}

export function StatCard({
  label,
  value,
  desc,
  tone = 'navy',
  style,
}: {
  label: string
  value: string | number
  desc?: string
  tone?: 'navy' | 'green' | 'orange' | 'red'
  style?: StyleProp<ViewStyle>
}) {
  const accent =
    tone === 'green'
      ? colors.secondary
      : tone === 'orange'
        ? colors.warning
        : tone === 'red'
          ? colors.danger
          : colors.primary
  return (
    <View style={[s.stat, { borderLeftColor: accent }, style]}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={[s.statValue, { color: accent }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {desc ? <Text style={s.statDesc}>{desc}</Text> : null}
    </View>
  )
}

export function ErrorBox({ message }: { message: string }) {
  if (!message) return null
  return (
    <View style={s.errorBox}>
      <Text style={s.errorText}>{message}</Text>
    </View>
  )
}

export function Loading({ text = 'Cargando...' }: { text?: string }) {
  return (
    <View style={s.center}>
      <ActivityIndicator color={colors.secondary} />
      <Text style={[s.emptyText, { marginTop: 8 }]}>{text}</Text>
    </View>
  )
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={s.center}>
      <Text style={s.emptyText}>{text}</Text>
    </View>
  )
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Text style={s.infoValue}>{value}</Text>
      ) : (
        value
      )}
    </View>
  )
}

export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.screenTitle}>{title}</Text>
      {subtitle ? <Text style={s.screenSubtitle}>{subtitle}</Text> : null}
    </View>
  )
}

// ------------------------------------------------------------------
// Estilos
// ------------------------------------------------------------------
export const listContent = (bottomInset: number) => ({
  padding: 16,
  paddingBottom: bottomInset + 32,
})

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
    ...shadow,
  },
  btn: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  btnSmall: { minHeight: 36, paddingHorizontal: 12, borderRadius: 8 },
  btnText: { fontWeight: '700', fontSize: 15 },
  fieldWrap: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: colors.primary, marginBottom: 6 },
  hint: { fontSize: 12, color: colors.muted, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 13 : 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: '#fff',
  },
  selectBox: { flexDirection: 'row', alignItems: 'center' },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#E9EEF3',
    borderRadius: 10,
    padding: 3,
  },
  segItem: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segItemActive: { backgroundColor: '#fff', ...shadow, shadowOpacity: 0.05, elevation: 1 },
  segText: { fontSize: 13, color: colors.textSoft, fontWeight: '500' },
  segTextActive: { color: colors.secondary, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(8, 28, 45, 0.55)', justifyContent: 'flex-end' },
  pickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '70%',
  },
  formSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '92%',
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.primary, marginBottom: 12 },
  pickerItem: { paddingVertical: 14, paddingHorizontal: 12, borderRadius: 8 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  stat: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    padding: 12,
    ...shadow,
  },
  statLabel: { fontSize: 12, color: colors.textSoft, fontWeight: '600' },
  statValue: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  statDesc: { fontSize: 11, color: colors.muted, marginTop: 2 },
  errorBox: {
    backgroundColor: colors.dangerBg,
    padding: 12,
    borderRadius: 8,
    marginBottom: 14,
  },
  errorText: { color: colors.dangerText, fontSize: 13, textAlign: 'center' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: 'center' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  infoLabel: { color: colors.textSoft, fontSize: 13, flexShrink: 1, paddingRight: 8 },
  infoValue: { color: colors.text, fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  screenTitle: { fontSize: 22, fontWeight: '800', color: colors.primary },
  screenSubtitle: { fontSize: 13, color: colors.muted, marginTop: 2 },
})

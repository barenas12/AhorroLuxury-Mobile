import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

import { formatCurrency } from './format'

const ANDROID_CHANNEL_ID = 'ahorro-luxury-movimientos'

// Configuración global para mostrar notificaciones incluso con la app abierta en primer plano
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  })
}

/** Sets registrados localmente en esta sesión para evitar duplicar notificaciones con el poller */
const recentlyNotifiedKeys = new Set<string>()

export function markMovementNotified(key: string): void {
  recentlyNotifiedKeys.add(key)
}

export function wasMovementNotified(key: string): boolean {
  return recentlyNotifiedKeys.has(key)
}

/**
 * Solicita permisos de notificaciones en el dispositivo y configura el canal de Android.
 */
export async function initializeNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return false

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Movimientos y Pagos',
        description: 'Alertas de pagos, abonos, préstamos y movimientos en Ahorro Luxury',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 200, 250],
        lightColor: '#1F7A63',
        sound: 'default',
      })
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    return finalStatus === 'granted'
  } catch {
    return false
  }
}

/**
 * Envía una notificación local inmediata al dispositivo.
 */
export async function sendLocalNotification({
  title,
  body,
  data,
}: {
  title: string
  body: string
  data?: Record<string, unknown>
}): Promise<void> {
  if (Platform.OS === 'web') return

  try {
    const hasPermission = await initializeNotifications()
    if (!hasPermission) return

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data ?? {},
        sound: 'default',
        ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
      },
      trigger: null,
    })
  } catch {
    // Evitar que un fallo en permisos de notificaciones interrumpa el flujo de negocio
  }
}

/**
 * Notifica cuando se registra un pago, abono de ahorro, boleta o multa.
 */
export async function notifyPaymentRegistered(params: {
  paymentIds?: number[]
  partnerName: string
  concepts: string[]
  totalAmount: number
}): Promise<void> {
  const { paymentIds = [], partnerName, concepts, totalAmount } = params
  paymentIds.forEach((id) => markMovementNotified(`payment:${id}`))

  const uniqueConcepts = Array.from(new Set(concepts))
  const conceptLabel = uniqueConcepts.join(', ')
  const isAbono = uniqueConcepts.some((c) => c.toLowerCase().includes('abono'))

  await sendLocalNotification({
    title: isAbono ? '✅ Abono registrado' : '✅ Pago registrado',
    body: `Se registró ${conceptLabel} por ${formatCurrency(totalAmount)} para ${partnerName}.`,
    data: { type: 'payment', paymentIds },
  })
}

/**
 * Notifica cuando se entrega / registra un nuevo préstamo.
 */
export async function notifyLoanCreated(params: {
  loanId?: number
  partnerName: string
  amount: number
  termDays: number
}): Promise<void> {
  const { loanId, partnerName, amount, termDays } = params
  if (loanId) markMovementNotified(`loan:${loanId}`)

  await sendLocalNotification({
    title: '💰 Nuevo préstamo registrado',
    body: `Se registró un préstamo por ${formatCurrency(amount)} a nombre de ${partnerName} (${termDays} días).`,
    data: { type: 'loan', loanId },
  })
}

/**
 * Notifica cuando se registra un abono a un préstamo (capital y/o intereses).
 */
export async function notifyLoanAbonoRegistered(params: {
  loanId: number
  paymentIds?: number[]
  partnerName: string
  abonoTotal: number
  abonoCapital: number
  abonoInteres: number
}): Promise<void> {
  const { loanId, paymentIds = [], partnerName, abonoTotal, abonoCapital, abonoInteres } = params
  paymentIds.forEach((id) => markMovementNotified(`payment:${id}`))
  markMovementNotified(`loan-pay:${loanId}:${abonoTotal}`)

  const details: string[] = []
  if (abonoCapital > 0) details.push(`Capital: ${formatCurrency(abonoCapital)}`)
  if (abonoInteres > 0) details.push(`Interés: ${formatCurrency(abonoInteres)}`)
  const detailSuffix = details.length > 0 ? ` (${details.join(' · ')})` : ''

  await sendLocalNotification({
    title: '✅ Abono a préstamo registrado',
    body: `Se registró un abono por ${formatCurrency(abonoTotal)} al préstamo de ${partnerName}${detailSuffix}.`,
    data: { type: 'loan_payment', loanId, paymentIds },
  })
}

/**
 * Notifica cuando se registra un egreso de caja.
 */
export async function notifyEgressRegistered(params: {
  concept: string
  recipient: string
  amount: number
}): Promise<void> {
  const { concept, recipient, amount } = params
  await sendLocalNotification({
    title: '📤 Movimiento de egreso registrado',
    body: `Se registró "${concept}" por ${formatCurrency(amount)} a favor de ${recipient}.`,
    data: { type: 'egress' },
  })
}


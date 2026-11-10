import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useRef } from 'react'
import { AppState, Platform } from 'react-native'

import { getEgresses, getLoans, getPayments } from '@/api/services'
import type { UserSession } from '@/api/types'
import { formatCurrency } from '@/utils/format'
import {
  initializeNotifications,
  markMovementNotified,
  sendLocalNotification,
  wasMovementNotified,
} from '@/utils/notifications'

interface SnapshotState {
  initialized: boolean
  maxPaymentId: number
  maxLoanId: number
  maxEgressId: number
  /** loanId -> total abonado (paidCapital + paidInterest) */
  loanPaidTotals: Record<string, number>
}

const POLL_INTERVAL_MS = 25_000

/**
 * Monitorea periódicamente y al volver al primer plano si se han registrado nuevos
 * pagos, abonos, préstamos o egresos, enviando una notificación al usuario de la app.
 */
export function useMovementNotifications(user: UserSession | null) {
  const checkingRef = useRef(false)

  useEffect(() => {
    if (!user || Platform.OS === 'web') return

    let cancelled = false
    const storageKey = `al_notif_snapshot_${user.id}`
    const isPartnerRole = Number(user.profile) === 3
    const userDoc = String(user.user || '').trim()

    void initializeNotifications()

    const checkMovements = async () => {
      if (checkingRef.current || cancelled) return
      checkingRef.current = true

      try {
        const [payments, loans, egresses] = await Promise.all([
          getPayments().catch(() => null),
          getLoans().catch(() => null),
          getEgresses().catch(() => null),
        ])

        if (cancelled || (!payments && !loans && !egresses)) return

        const rawSaved = await AsyncStorage.getItem(storageKey)
        let snapshot: SnapshotState = rawSaved
          ? (JSON.parse(rawSaved) as SnapshotState)
          : {
              initialized: false,
              maxPaymentId: 0,
              maxLoanId: 0,
              maxEgressId: 0,
              loanPaidTotals: {},
            }

        const currentMaxPaymentId = payments
          ? payments.reduce((max, p) => Math.max(max, Number(p.id) || 0), snapshot.maxPaymentId)
          : snapshot.maxPaymentId
        const currentMaxLoanId = loans
          ? loans.reduce((max, l) => Math.max(max, Number(l.id) || 0), snapshot.maxLoanId)
          : snapshot.maxLoanId
        const currentMaxEgressId = egresses
          ? egresses.reduce((max, e) => Math.max(max, Number(e.id) || 0), snapshot.maxEgressId)
          : snapshot.maxEgressId

        const nextLoanPaidTotals: Record<string, number> = { ...snapshot.loanPaidTotals }
        if (loans) {
          for (const loan of loans) {
            nextLoanPaidTotals[String(loan.id)] =
              Number(loan.paidCapital || 0) + Number(loan.paidInterest || 0)
          }
        }

        // Si es la primera sincronización en este dispositivo, guardamos la línea base sin saturar con historial antiguo
        if (!snapshot.initialized) {
          const initialSnapshot: SnapshotState = {
            initialized: true,
            maxPaymentId: currentMaxPaymentId,
            maxLoanId: currentMaxLoanId,
            maxEgressId: currentMaxEgressId,
            loanPaidTotals: nextLoanPaidTotals,
          }
          await AsyncStorage.setItem(storageKey, JSON.stringify(initialSnapshot))
          return
        }

        // 1. Nuevos pagos o abonos registrados
        if (payments && currentMaxPaymentId > snapshot.maxPaymentId) {
          const newPayments = payments
            .filter((p) => Number(p.id) > snapshot.maxPaymentId)
            .filter((p) => !isPartnerRole || String(p.partnerDocument).trim() === userDoc)
            .sort((a, b) => Number(a.id) - Number(b.id))

          for (const p of newPayments) {
            const key = `payment:${p.id}`
            if (wasMovementNotified(key)) continue
            markMovementNotified(key)

            const isAbono = p.concept.toLowerCase().includes('abono')
            const conceptText = p.ticketNumber ? `${p.concept} (#${p.ticketNumber})` : p.concept

            await sendLocalNotification({
              title: isAbono ? '✅ Nuevo abono registrado' : '✅ Nuevo pago registrado',
              body:
                String(p.partnerDocument).trim() === userDoc
                  ? `Se registró tu movimiento de ${conceptText} por ${formatCurrency(p.totalPaid)}.`
                  : `Se registró ${conceptText} por ${formatCurrency(p.totalPaid)} para ${p.partnerName}.`,
              data: { type: 'payment', paymentId: p.id },
            })
          }
        }

        // 2. Nuevos préstamos o nuevos abonos a préstamos existentes
        if (loans) {
          const relevantLoans = loans.filter(
            (l) => !isPartnerRole || String(l.documentId).trim() === userDoc,
          )

          for (const l of relevantLoans) {
            const loanId = Number(l.id)
            const totalPaidNow = Number(l.paidCapital || 0) + Number(l.paidInterest || 0)
            const prevPaid = snapshot.loanPaidTotals[String(loanId)] ?? 0

            if (loanId > snapshot.maxLoanId) {
              const key = `loan:${loanId}`
              if (!wasMovementNotified(key)) {
                markMovementNotified(key)
                await sendLocalNotification({
                  title: '💰 Nuevo préstamo registrado',
                  body:
                    String(l.documentId).trim() === userDoc
                      ? `Se registró un préstamo a tu nombre por ${formatCurrency(l.initialCapital)} (${l.termDays} días).`
                      : `Se registró un préstamo por ${formatCurrency(l.initialCapital)} para ${l.partnerName}.`,
                  data: { type: 'loan', loanId },
                })
              }
            } else if (totalPaidNow > prevPaid) {
              const delta = Math.round(totalPaidNow - prevPaid)
              const key = `loan-pay:${loanId}:${delta}`
              if (!wasMovementNotified(key)) {
                markMovementNotified(key)
                await sendLocalNotification({
                  title: '✅ Abono a préstamo registrado',
                  body:
                    String(l.documentId).trim() === userDoc
                      ? `Se registró un abono por ${formatCurrency(delta)} a tu préstamo.`
                      : `Se registró un abono por ${formatCurrency(delta)} al préstamo de ${l.partnerName}.`,
                  data: { type: 'loan_payment', loanId },
                })
              }
            }
          }
        }

        // 3. Nuevos egresos (para administradores/coordinadores)
        if (!isPartnerRole && egresses && currentMaxEgressId > snapshot.maxEgressId) {
          const newEgresses = egresses
            .filter((e) => Number(e.id) > snapshot.maxEgressId)
            .sort((a, b) => Number(a.id) - Number(b.id))

          for (const e of newEgresses) {
            // Evitar duplicar notificación si es el egreso automático de un préstamo recién notificado
            if (e.concept.startsWith('Préstamo Entregado - C.C.')) continue
            const key = `egress:${e.id}`
            if (wasMovementNotified(key)) continue
            markMovementNotified(key)

            await sendLocalNotification({
              title: '📤 Nuevo egreso registrado',
              body: `Se registró "${e.concept}" por ${formatCurrency(e.amount)} para ${e.recipient}.`,
              data: { type: 'egress', egressId: e.id },
            })
          }
        }

        snapshot = {
          initialized: true,
          maxPaymentId: currentMaxPaymentId,
          maxLoanId: currentMaxLoanId,
          maxEgressId: currentMaxEgressId,
          loanPaidTotals: nextLoanPaidTotals,
        }
        await AsyncStorage.setItem(storageKey, JSON.stringify(snapshot))
      } catch {
        // Ignorar fallos de red temporales en el monitoreo en segundo plano
      } finally {
        checkingRef.current = false
      }
    }

    void checkMovements()

    const interval = setInterval(() => {
      void checkMovements()
    }, POLL_INTERVAL_MS)

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void checkMovements()
      }
    })

    return () => {
      cancelled = true
      clearInterval(interval)
      sub.remove()
    }
  }, [user])
}


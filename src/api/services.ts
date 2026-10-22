import { request } from './client'
import type {
  CoordinatorOption,
  DashboardData,
  EgressPayload,
  EgressRecord,
  LoanFormPayload,
  LoanPaymentPayload,
  LoanRecord,
  PartnerOption,
  PartnerSavings,
  PartnerUser,
  PaymentRecord,
  PaymentsPayload,
  RaffleItem,
  UserFormPayload,
  UserSession,
} from './types'

// ---------- Login ----------
// POST /api/login/check-user  -> { success, data: usuario }
export const login = (user: string, password: string) =>
  request<UserSession>('/api/login/check-user', {
    method: 'POST',
    body: { user, password },
  })

// POST /api/users/change-password
export const changePasswordFirstLogin = (username: string, newPassword: string) =>
  request<void>('/api/users/change-password', {
    method: 'POST',
    body: { username, newPassword },
  })

// ---------- Dashboard ----------
export const getDashboardSummary = () =>
  request<DashboardData>('/api/dashboard/summary')

// ---------- Ahorro programado ----------
export const getSavingsDashboard = () =>
  request<PartnerSavings[]>('/api/savings/dashboard')

// ---------- Usuarios ----------
export const getUsers = () => request<PartnerUser[]>('/api/users')
export const getCoordinators = () =>
  request<CoordinatorOption[]>('/api/users/coordinators')
export const getRaffle = (type: '1' | '2') =>
  request<RaffleItem[]>(`/api/users/raffle/${type}`)

export const createUser = (payload: UserFormPayload) =>
  request<void>('/api/users', { method: 'POST', body: payload })

// El backend espera PUT /api/users con el id dentro del body
export const updateUser = (payload: UserFormPayload) =>
  request<void>('/api/users', { method: 'PUT', body: payload })

// El backend espera PATCH /api/users/status con { documentId, status }
export const setPartnerStatus = (documentId: string, status: number) =>
  request<void>('/api/users/status', {
    method: 'PATCH',
    body: { documentId, status },
  })

// El backend espera POST /api/users/reset-password con { documentId }
export const resetUserPassword = (documentId: string) =>
  request<void>('/api/users/reset-password', {
    method: 'POST',
    body: { documentId },
  })

// ---------- Pagos ----------
export const getPayments = () => request<PaymentRecord[]>('/api/payments')
export const getActivePartners = () =>
  request<PartnerOption[]>('/api/payments/partners')
export const createPayments = (payload: PaymentsPayload) =>
  request<{ paymentIds: number[] }>('/api/payments', { method: 'POST', body: payload })

// ---------- Préstamos ----------
export const getLoans = () => request<LoanRecord[]>('/api/loans')
export const createLoan = (payload: LoanFormPayload) =>
  request<{ id: number }>('/api/loans', { method: 'POST', body: payload })
export const payLoan = (loanId: number, payload: LoanPaymentPayload) =>
  request<{ paymentIds: number[] }>(`/api/loans/${loanId}/pay`, { method: 'POST', body: payload })

// ---------- Egresos ----------
export const getEgresses = () => request<EgressRecord[]>('/api/egresses')
export const createEgress = (payload: EgressPayload) =>
  request<void>('/api/egresses', { method: 'POST', body: payload })

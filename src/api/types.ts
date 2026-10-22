// Tipos que reflejan las respuestas de AhorroLuxury-Back

export type PaymentMethod = 'efectivo' | 'transferencia'

/** Respuesta de POST /api/login/check-user (sin password) */
export interface UserSession {
  id: number
  name: string
  lastName: string
  full_name: string
  /** 1 = Administrador, 2 = Coordinador, 3 = Socio */
  profile: number
  /** Documento / usuario de acceso */
  user: string
  resetPassword: number
  userStatus: number
  partnerStatus: number
}

// ----- Dashboard -----
export interface RecaudoItem {
  paymentMethod: string
  concept: string
  totalAmount: string | number
  totalFines: string | number
}
export interface SalidaItem {
  paymentMethod: string
  totalEgress: string | number
}
export interface DashboardData {
  recaudo: RecaudoItem[]
  salidas: SalidaItem[]
  capitalPrestadoTotal: number
}

// ----- Usuarios / socios -----
export interface PartnerUser {
  id: number
  documentId: string
  name: string
  lastName: string
  fullName: string
  savingsValue: number
  frequency: number
  cellphone: number
  coordinator: number
  coordinatorName: string
  partnerStatus: number
  profile: number
  userLoginStatus: number
  resetPassword: number
  ticket?: string | string[] | null
  ticket2?: string | string[] | null
}
export interface CoordinatorOption {
  id: number
  fullName: string
  profile: number
}
export interface UserFormPayload {
  id?: number
  documentId: string
  name: string
  lastName: string
  savingsValue: number
  frequency: number
  cellphone: number
  coordinator: number
  profile: number
  canLogin: boolean
  ticket: string[]
  ticket2: string[]
}

// ----- Rifas -----
export interface RaffleItem {
  number: string
  isAssigned: boolean
  partner: {
    id: number
    documentId: string
    fullName: string
    cellphone: number
  } | null
}

// ----- Ahorro programado -----
export interface TicketStatusItem {
  number: string
  raffle: string
  isPaid: boolean
  status: 'Al día' | 'En mora'
}
export interface PartnerSavings {
  id: number
  documentId: string
  fullName: string
  cellphone: number
  coordinatorName: string
  frequency: number
  savingsValue: number
  totalSavedCurrentPeriod: number
  overdueAmount: number
  savingsStatus: 'Al día' | 'En mora'
  nextDueDate: string
  daysRemaining: number
  ticketsStatus: TicketStatusItem[]
  generalTicketStatus: 'Al día' | 'En mora'
}

// ----- Pagos -----
export interface PaymentRecord {
  id: number
  partnerId: number
  partnerDocument: string
  partnerName: string
  registeredBy: number
  registeredByName: string
  amount: number
  concept: string
  ticketNumber?: string | null
  paymentMethod: PaymentMethod
  hasFine: number
  fineAmount: number
  totalPaid: number
  paymentDate: string
  createdAt: string
  observations?: string | null
}
export interface PartnerOption {
  id: number
  documentId: string
  fullName: string
  savingsValue: number
  ticket?: string | string[] | null
}
export interface PaymentItemPayload {
  concept: string
  ticketNumber: string | null
  amount: number
  paymentMethod: PaymentMethod
  paymentDate: string
  observations: string
  hasFine: boolean
  fineAmount: number
}
export interface PaymentsPayload {
  partnerId: number
  registeredBy: number
  items: PaymentItemPayload[]
}

// ----- Préstamos -----
export interface LoanRecord {
  id: number
  partnerId: number
  partnerName: string
  documentId: string
  initialCapital: number
  interestRate: number
  deliveryMethod: PaymentMethod
  guarantee: string
  deliveryDate: string
  termDays: number
  dueDate: string
  installments: number
  status: 'Activo' | 'Pagado' | 'En mora' | 'Anulado'
  observations: string
  paidCapital: number
  paidInterest: number
  registeredByName: string
}
export interface LoanFormPayload {
  partnerId: number
  initialCapital: number
  interestRate: number
  deliveryMethod: PaymentMethod
  guarantee: string
  deliveryDate: string
  termDays: number
  dueDate: string
  installments: number
  observations: string
  registeredBy: number
}
export interface LoanPaymentPayload {
  registeredBy: number
  paymentDate: string
  observations: string
  capitalEfectivo: number
  capitalTransferencia: number
  interesEfectivo: number
  interesTransferencia: number
}

// ----- Egresos -----
export interface EgressRecord {
  id: number
  concept: string
  amount: string | number
  paymentMethod: PaymentMethod
  recipient: string
  paymentDate: string
  observations: string
  registeredByName: string
}
export interface EgressPayload {
  concept: string
  amount: number
  paymentMethod: PaymentMethod
  recipient: string
  paymentDate: string
  observations: string
  registeredBy: number
}

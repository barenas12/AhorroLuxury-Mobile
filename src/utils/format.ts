/** $ 1.234.567 (formato COP, sin depender de Intl en el motor JS) */
export function formatCurrency(value: number | string | null | undefined): string {
  const n = Math.round(Number(value) || 0)
  const sign = n < 0 ? '-' : ''
  const digits = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}$ ${digits}`
}

/** Recorta fechas ISO de MySQL a YYYY-MM-DD */
export function formatDate(value: string | null | undefined): string {
  return value ? String(value).substring(0, 10) : ''
}

export function todayISO(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Suma `days` a una fecha YYYY-MM-DD y devuelve YYYY-MM-DD */
export function addDays(dateStr: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !days) return ''
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + Number(days))
  return d.toISOString().substring(0, 10)
}

export function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const d = new Date(`${dateStr}T00:00:00Z`)
  return !isNaN(d.getTime()) && d.toISOString().substring(0, 10) === dateStr
}

/** Boletas guardadas como JSON ('["01","05"]'), lista separada por comas o array */
export function parseTickets(raw: string | string[] | null | undefined): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
  }
}

/** Solo dígitos -> número (campos de dinero) */
export function toNumber(text: string): number {
  const n = Number(text.replace(/[^\d.-]/g, ''))
  return isNaN(n) ? 0 : n
}

export function roleLabel(profile: number | string | undefined): string {
  switch (Number(profile)) {
    case 1:
      return 'Administrador'
    case 2:
      return 'Coordinador'
    default:
      return 'Socio'
  }
}

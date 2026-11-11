export const BACKEND_URL = 'https://ahorro-luxury-back.vercel.app'

export const API_URL: string = (
  process.env.EXPO_PUBLIC_API_URL && process.env.EXPO_PUBLIC_API_URL.trim() !== ''
    ? process.env.EXPO_PUBLIC_API_URL.trim()
    : BACKEND_URL
).replace(/\/+$/, '')

export const INACTIVITY_LIMIT_MS = 30 * 60 * 1000 // 30 minutos, igual que la web

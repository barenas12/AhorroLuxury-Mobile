import Constants from 'expo-constants'
import { Platform } from 'react-native'

/**
 * URL base del backend (AhorroLuxury-Back, puerto 3000 por defecto).
 *
 * Prioridad:
 *  1. EXPO_PUBLIC_API_URL (archivo .env), p. ej. https://api.midominio.com
 *  2. Host del servidor de Metro que usa Expo Go (mismo PC que corre el backend)
 *  3. Emulador Android -> 10.0.2.2 ; resto -> localhost
 */
const envUrl = process.env.EXPO_PUBLIC_API_URL

const metroHost = Constants.expoConfig?.hostUri?.split(':')[0]

const fallbackHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost'

export const API_URL: string = (
  envUrl && envUrl.trim() !== ''
    ? envUrl
    : `http://${metroHost || fallbackHost}:3000`
).replace(/\/+$/, '')

export const INACTIVITY_LIMIT_MS = 30 * 60 * 1000 // 30 minutos, igual que la web

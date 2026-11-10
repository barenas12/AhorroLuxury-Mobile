import AsyncStorage from '@react-native-async-storage/async-storage'
import * as LocalAuthentication from 'expo-local-authentication'
import { Platform } from 'react-native'

import type { UserSession } from '@/api/types'

const BIOMETRIC_CREDS_KEY = 'al_biometric_creds'

export interface BiometricSavedCredentials {
  username: string
  password?: string
  session: UserSession
}

export interface BiometricSupport {
  /** true si el dispositivo tiene hardware biométrico y al menos una huella/rostro registrado */
  isAvailable: boolean
  /** Tipo principal detectado para mostrar en textos e íconos */
  biometricType: 'facial' | 'fingerprint' | 'both' | 'generic' | 'none'
  /** Texto descriptivo según el dispositivo, p. ej. "Reconocimiento Facial" o "Huella Digital" */
  label: string
  /** Nombre del ícono de Ionicons acorde al tipo de desbloqueo */
  iconName: 'scan-outline' | 'finger-print-outline' | 'lock-closed-outline'
}

/**
 * Detecta las capacidades biométricas del dispositivo (Huella / Face ID / Reconocimiento facial).
 */
export async function getBiometricSupport(): Promise<BiometricSupport> {
  if (Platform.OS === 'web') {
    return {
      isAvailable: false,
      biometricType: 'none',
      label: 'Biometría',
      iconName: 'lock-closed-outline',
    }
  }

  try {
    const [hasHardware, isEnrolled, supportedTypes] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ])

    if (!hasHardware || !isEnrolled) {
      return {
        isAvailable: false,
        biometricType: 'none',
        label: 'Biometría',
        iconName: 'lock-closed-outline',
      }
    }

    const hasFace = supportedTypes.includes(
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
    )
    const hasFingerprint = supportedTypes.includes(
      LocalAuthentication.AuthenticationType.FINGERPRINT,
    )

    if (hasFace && hasFingerprint) {
      return {
        isAvailable: true,
        biometricType: 'both',
        label: 'Huella o Reconocimiento Facial',
        iconName: 'finger-print-outline',
      }
    }

    if (hasFace) {
      return {
        isAvailable: true,
        biometricType: 'facial',
        label: 'Reconocimiento Facial',
        iconName: 'scan-outline',
      }
    }

    if (hasFingerprint) {
      return {
        isAvailable: true,
        biometricType: 'fingerprint',
        label: 'Huella Digital',
        iconName: 'finger-print-outline',
      }
    }

    return {
      isAvailable: true,
      biometricType: 'generic',
      label: 'Biometría del dispositivo',
      iconName: 'lock-closed-outline',
    }
  } catch {
    return {
      isAvailable: false,
      biometricType: 'none',
      label: 'Biometría',
      iconName: 'lock-closed-outline',
    }
  }
}

/**
 * Solicita autenticación biométrica (huella o rostro según el dispositivo).
 */
export async function authenticateWithBiometrics(
  promptMessage = 'Desbloquea Ahorro Luxury con tu huella o rostro',
): Promise<boolean> {
  if (Platform.OS === 'web') return true
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Usar contraseña',
      fallbackLabel: 'Usar código del dispositivo',
      disableDeviceFallback: false,
    })
    return result.success
  } catch {
    return false
  }
}

/**
 * Guarda las credenciales del último inicio de sesión exitoso para permitir ingreso biométrico.
 */
export async function saveBiometricCredentials(data: BiometricSavedCredentials): Promise<void> {
  try {
    await AsyncStorage.setItem(BIOMETRIC_CREDS_KEY, JSON.stringify(data))
  } catch {
    // Ignorar errores de almacenamiento secundario
  }
}

/**
 * Obtiene las credenciales guardadas para inicio de sesión con huella o rostro.
 */
export async function getSavedBiometricCredentials(): Promise<BiometricSavedCredentials | null> {
  try {
    const raw = await AsyncStorage.getItem(BIOMETRIC_CREDS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BiometricSavedCredentials
    if (!parsed?.username || !parsed?.session) return null
    return parsed
  } catch {
    return null
  }
}

export async function clearBiometricCredentials(): Promise<void> {
  try {
    await AsyncStorage.removeItem(BIOMETRIC_CREDS_KEY)
  } catch {
    // Ignorar
  }
}


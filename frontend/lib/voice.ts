'use client'

import { useSyncExternalStore } from 'react'

const API_BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api`

export type VoiceLanguage = 'auto' | 'en-IN' | 'hi-IN' | 'ta-IN' | 'te-IN' | 'kn-IN' | 'ml-IN'

// Must match LANGUAGES in backend-node/src/services/sarvam.js (plus 'auto').
export const VOICE_LANGUAGES: { code: VoiceLanguage; label: string; short: string }[] = [
  { code: 'auto', label: 'Auto detect', short: 'Auto' },
  { code: 'en-IN', label: 'English', short: 'EN' },
  { code: 'hi-IN', label: 'हिन्दी', short: 'हि' },
  { code: 'ta-IN', label: 'தமிழ்', short: 'த' },
  { code: 'te-IN', label: 'తెలుగు', short: 'తె' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ', short: 'ಕ' },
  { code: 'ml-IN', label: 'മലയാളം', short: 'മ' },
]

const isVoiceLanguage = (v: unknown): v is VoiceLanguage => VOICE_LANGUAGES.some(l => l.code === v)

const STORAGE_KEY = 'voiceLanguage'
const listeners = new Set<() => void>()

const readLanguage = (): VoiceLanguage => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return isVoiceLanguage(saved) ? saved : 'auto'
  } catch {
    return 'auto' // storage blocked
  }
}

const subscribe = (onChange: () => void) => {
  listeners.add(onChange)
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

const writeLanguage = (next: VoiceLanguage) => {
  try {
    localStorage.setItem(STORAGE_KEY, next)
    memoryValue = null
  } catch {
    memoryValue = next // storage blocked: the choice lasts until reload
  }
  listeners.forEach(l => l())
}

// Fallback when localStorage throws, so the picker still works for this page view.
let memoryValue: VoiceLanguage | null = null
const getSnapshot = () => memoryValue ?? readLanguage()

/** Picker value, remembered per browser. Falls back to 'auto' when storage is unavailable. */
export const useVoiceLanguage = () => {
  const language = useSyncExternalStore(subscribe, getSnapshot, () => 'auto' as VoiceLanguage)
  return [language, writeLanguage] as const
}

const errorMessage = async (res: Response) => {
  const body = await res.json().catch(() => null)
  return body?.error ?? `Request failed (${res.status})`
}

export const fetchVoiceEnabled = async (token: string): Promise<boolean> => {
  try {
    const res = await fetch(`${API_BASE_URL}/voice/config`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return false
    return Boolean((await res.json())?.enabled)
  } catch {
    return false
  }
}

export const transcribeAudio = async (audio: Blob, language: VoiceLanguage, token: string) => {
  const res = await fetch(`${API_BASE_URL}/voice/transcribe?language=${language}`, {
    method: 'POST',
    headers: { 'Content-Type': audio.type || 'audio/webm', Authorization: `Bearer ${token}` },
    body: audio,
  })
  if (!res.ok) throw new Error(await errorMessage(res))
  return (await res.json()) as { transcript: string; languageCode: string | null }
}

export const speakText = async (text: string, language: string, token: string) => {
  const res = await fetch(`${API_BASE_URL}/voice/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ text, language }),
  })
  if (!res.ok) throw new Error(await errorMessage(res))
  return res.blob()
}

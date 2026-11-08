'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const MAX_SECONDS = 30 // Sarvam's synchronous speech to text is meant for clips under 30 s

const pickMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return undefined
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4']
    .find(t => MediaRecorder.isTypeSupported(t))
}

/**
 * Microphone recorder. `onRecorded` receives the finished clip after stop()
 * (or the 30 s auto-stop). Mic tracks are released on stop and on unmount.
 */
export const useRecorder = ({ onRecorded, onError }: {
  onRecorded: (audio: Blob) => void
  onError: (message: string) => void
}) => {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const callbacks = useRef({ onRecorded, onError })
  useEffect(() => { callbacks.current = { onRecorded, onError } })

  const release = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setRecording(false)
  }, [])

  const stop = useCallback(() => {
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') rec.stop()
    else release()
  }, [release])

  const start = useCallback(async () => {
    if (recorderRef.current?.state === 'recording') return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      callbacks.current.onError('This browser can’t record audio.')
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      const denied = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')
      callbacks.current.onError(denied ? 'Microphone access was blocked. Allow it in the browser to use voice.' : 'Couldn’t access the microphone.')
      return
    }

    const mimeType = pickMimeType()
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
    rec.onstop = () => {
      release()
      recorderRef.current = null
      const audio = new Blob(chunks, { type: (rec.mimeType || mimeType || 'audio/webm').split(';')[0] })
      if (audio.size > 0) callbacks.current.onRecorded(audio)
    }

    streamRef.current = stream
    recorderRef.current = rec
    rec.start()
    setSeconds(0)
    setRecording(true)

    const startedAt = Date.now()
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000)
      setSeconds(elapsed)
      if (elapsed >= MAX_SECONDS) stop()
    }, 250)
  }, [release, stop])

  // Unmount: drop the clip and free the mic.
  useEffect(() => () => {
    const rec = recorderRef.current
    if (rec) {
      rec.onstop = null
      if (rec.state !== 'inactive') rec.stop()
    }
    if (timerRef.current) clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
  }, [])

  return { recording, seconds, start, stop, maxSeconds: MAX_SECONDS }
}

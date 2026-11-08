'use client'

import { useRef, useState, KeyboardEvent } from 'react'
import { ArrowUp, Check, ChevronDown, Languages, Loader2, Mic, Square } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useRecorder } from '@/lib/useRecorder'
import { transcribeAudio, VOICE_LANGUAGES } from '@/lib/voice'

const ChatInput = ({
  onSendMessage,
  disabled = false,
  voiceEnabled = false,
  voiceLanguage = 'auto',
  onVoiceLanguageChange,
  accessToken,
}: ChatInputProps) => {
  const [input, setInput] = useState('')
  const [transcribing, setTranscribing] = useState(false)
  // Language Sarvam detected for the last recording (used when the picker is on Auto)
  const [spokenLanguage, setSpokenLanguage] = useState<string | undefined>(undefined)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleRecorded = async (audio: Blob) => {
    if (!accessToken) return
    setTranscribing(true)
    try {
      const { transcript, languageCode } = await transcribeAudio(audio, voiceLanguage, accessToken)
      if (!transcript) {
        toast('Didn’t catch that', { description: 'Try speaking a little closer to the mic.' })
        return
      }
      setInput(prev => (prev.trim() ? `${prev.trimEnd()} ${transcript}` : transcript))
      setSpokenLanguage(voiceLanguage === 'auto' ? languageCode ?? undefined : voiceLanguage)
      requestAnimationFrame(() => textareaRef.current?.focus())
    } catch (e) {
      toast.error('Couldn’t transcribe your voice', { description: e instanceof Error ? e.message : 'Please try again.' })
    } finally {
      setTranscribing(false)
    }
  }

  const recorder = useRecorder({
    onRecorded: handleRecorded,
    onError: (message) => toast.error(message),
  })

  const handleSend = () => {
    if (input.trim() && !disabled) {
      const language = voiceLanguage !== 'auto' ? voiceLanguage : spokenLanguage
      onSendMessage(input.trim(), language)
      setInput('')
      setSpokenLanguage(undefined)
    }
  }

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const current = VOICE_LANGUAGES.find(l => l.code === voiceLanguage) ?? VOICE_LANGUAGES[0]
  const busyVoice = recorder.recording || transcribing
  const remaining = recorder.maxSeconds - recorder.seconds

  return (
    <div className="px-3 sm:px-6 pb-3 sm:pb-6 pt-2">
      <div className="max-w-3xl mx-auto">
        <div className="flex gap-2 items-end bg-panel border border-line focus-within:border-line-strong rounded-2xl p-2 pl-4 transition-colors">
          {recorder.recording ? (
            <div className="flex-1 min-w-0 flex items-center gap-2.5 py-2.5 text-sm text-ink-muted" aria-live="polite">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full rounded-full bg-neg opacity-60 animate-ping" />
                <span className="relative inline-flex size-2.5 rounded-full bg-neg" />
              </span>
              Listening… <span className="tabular-nums text-ink-subtle">0:{String(recorder.seconds).padStart(2, '0')}</span>
              {remaining <= 5 && <span className="text-ink-subtle">· stops in {remaining}s</span>}
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={transcribing ? 'Transcribing…' : 'Ask about your finances...'}
              disabled={disabled || transcribing}
              rows={1}
              className="flex-1 min-w-0 bg-transparent text-base sm:text-sm text-ink placeholder:text-ink-subtle py-2.5 resize-none outline-none disabled:opacity-50 disabled:cursor-not-allowed overflow-y-auto"
              style={{
                minHeight: '40px',
                maxHeight: '128px'
              }}
            />
          )}

          {voiceEnabled && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={busyVoice}
                  className="flex items-center gap-1 text-ink-muted hover:text-ink hover:bg-control rounded-xl px-2 py-2.5 text-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
                  aria-label={`Voice language: ${current.label}`}
                  title="Voice language"
                >
                  {current.code === 'auto' ? <Languages className="size-4" /> : <span className="font-medium min-w-4 text-center">{current.short}</span>}
                  <ChevronDown className="size-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-44 bg-panel border-line text-ink">
                  <DropdownMenuLabel className="text-xs text-ink-subtle font-normal">Voice language</DropdownMenuLabel>
                  {VOICE_LANGUAGES.map(l => (
                    <DropdownMenuItem
                      key={l.code}
                      onClick={() => onVoiceLanguageChange?.(l.code)}
                      className="cursor-pointer text-ink-2 focus:bg-control focus:text-ink justify-between"
                    >
                      {l.label}
                      {l.code === voiceLanguage && <Check className="size-4" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <button
                onClick={recorder.recording ? recorder.stop : recorder.start}
                disabled={disabled || transcribing || !accessToken}
                className={`rounded-xl p-2.5 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                  recorder.recording ? 'bg-neg text-white' : 'text-ink-muted hover:text-ink hover:bg-control'
                }`}
                aria-label={recorder.recording ? 'Stop recording' : 'Speak your question'}
                title={recorder.recording ? 'Stop recording' : 'Speak your question'}
              >
                {transcribing
                  ? <Loader2 className="size-5 animate-spin" />
                  : recorder.recording ? <Square className="size-5" /> : <Mic className="size-5" />}
              </button>
            </>
          )}

          <button
            onClick={handleSend}
            disabled={disabled || busyVoice || !input.trim()}
            className="bg-brand hover:bg-brand-hover disabled:bg-control disabled:text-ink-subtle disabled:cursor-not-allowed text-white rounded-xl p-2.5 transition-colors cursor-pointer"
            aria-label="Send message"
          >
            <ArrowUp className='size-5' />
          </button>
        </div>
        <p className="hidden sm:block text-[11px] text-ink-subtle mt-2 text-center">
          Press Enter to send, Shift + Enter for new line{voiceEnabled && ' · Tap the mic to speak in English, Hindi, Tamil, Telugu, Kannada or Malayalam'}
        </p>
      </div>
    </div>
  )
}

export default ChatInput

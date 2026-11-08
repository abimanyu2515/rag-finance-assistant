'use client'

import PageShell from '@/components/PageShell'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ConversationDetail, Message } from '@/types/chat'
import MessageList from '@/components/assistant/MessageList'
import ChatInput from '@/components/assistant/ChatInput'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import type { SpeakState } from '@/components/assistant/MessageBubble'
import { fetchVoiceEnabled, speakText, useVoiceLanguage } from '@/lib/voice'

const API_BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api`

const Chatbot = () => {
  const { data: session } = useSession();
  const USER_ID = (session?.user as { _id?: string; id?: string } | undefined)?._id
    ?? (session?.user as { _id?: string; id?: string } | undefined)?.id;
  const ACCESS_TOKEN = (session as { accessToken?: string } | undefined)?.accessToken;
  const initial = session?.user?.name

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  // ───── Voice (Sarvam): mic input + read-aloud, hidden when the backend has no key ─────
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceLanguage, setVoiceLanguage] = useVoiceLanguage();
  const [speaking, setSpeaking] = useState<{ id: string; state: SpeakState } | null>(null);
  const audioRef = useRef<{ audio: HTMLAudioElement; url: string } | null>(null);

  useEffect(() => {
    if (!ACCESS_TOKEN) return;
    let cancelled = false;
    fetchVoiceEnabled(ACCESS_TOKEN).then(enabled => { if (!cancelled) setVoiceEnabled(enabled) });
    return () => { cancelled = true };
  }, [ACCESS_TOKEN]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.audio.pause();
      URL.revokeObjectURL(audioRef.current.url);
      audioRef.current = null;
    }
    setSpeaking(null);
  }, []);

  useEffect(() => stopAudio, [stopAudio]);

  const handleSpeak = async (message: Message) => {
    if (!ACCESS_TOKEN) return;
    const wasThis = speaking?.id === message.id;
    stopAudio();
    if (wasThis) return; // second click stops

    // Old messages have no language: use the picker, or English on Auto
    const language = message.language ?? (voiceLanguage === 'auto' ? 'en-IN' : voiceLanguage);
    setSpeaking({ id: message.id, state: 'loading' });
    try {
      const blob = await speakText(message.content, language, ACCESS_TOKEN);
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = { audio, url };
      audio.onended = () => { if (audioRef.current?.audio === audio) stopAudio() };
      await audio.play();
      setSpeaking(cur => (cur?.id === message.id ? { id: message.id, state: 'playing' } : cur));
    } catch (e) {
      stopAudio();
      toast.error('Couldn’t read that aloud', { description: e instanceof Error ? e.message : 'Please try again.' });
    }
  };

  const loadConversation = async (conversationId: string) => {
    if (!USER_ID) return;
    try {
      const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}?userId=${USER_ID}`);
      if (!response.ok) throw new Error(`Request failed (${response.status})`);

      const conversation: ConversationDetail = await response.json();
      const loadedMessages = conversation.messages.map((message, index) => ({
        id: `${conversation._id}-${index}`,
        role: message.role,
        content: message.content,
        created_at: new Date(message.created_at)
      }));

      setMessages(loadedMessages);
      setCurrentConversationId(conversationId);
    } catch (error) {
      console.error('Error loading conversation:', error);
      toast.error('Couldn’t open that conversation', { description: 'Please try again.' });
    }
  }

  // Remove the assistant placeholder bubble if nothing was streamed into it
  const dropIfEmpty = (id: string) =>
    setMessages(prev => prev.filter(msg => msg.id !== id || msg.content.trim() !== ''))

  const handleSend = async (userMessage: Message, language?: string) => {
    if (!USER_ID || !ACCESS_TOKEN) return;
    setLoading(true)
    setStatus(undefined)

    const aiMessageId = (Date.now() + 1).toString();
    setMessages(prev => [
      ...prev,
      {
        id: aiMessageId,
        role: 'assistant',
        content: '',
        created_at: new Date(),
        language,
      },
    ])
    
    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ACCESS_TOKEN}`
        },
        body: JSON.stringify({
          message: userMessage.content,
          userId: USER_ID,
          conversationId: currentConversationId,
          language,
        })
      })

      if (!response.ok || !response.body) throw new Error(`Request failed (${response.status})`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, {stream: true})
        const lines = text.split('\n').filter((l) => l.startsWith('data: '));

        for (const line of lines) {
          const json = line.replace('data: ', "").trim();

          try {
            const parsed = JSON.parse(json);
            
            if (parsed.conversationId) {
              setCurrentConversationId(parsed.conversationId);
            }
            // Tool progress label, shown in the typing indicator until the first token
            if (parsed.status) {
              setStatus(String(parsed.status))
            }
            if (parsed.token) {
              setMessages(prev => prev.map(msg => msg.id === aiMessageId ? 
                {...msg, content: msg.content + parsed.token} : msg
              ))
            }

            if (parsed.saved) {
              window.dispatchEvent(new CustomEvent("ai-chat:refresh-conversations"))
            }

            if (parsed.error) {
              dropIfEmpty(aiMessageId)
              toast.error('The assistant couldn’t answer', { description: String(parsed.error) })
            }
          } catch (e) {
            console.error('Error parsing message chunk:', e)
          }
        }
      }

    } catch (e) {
      console.error('Error sending message:', e)
      dropIfEmpty(aiMessageId)
      toast.error('Couldn’t get a response', { description: 'Check that the backend is running and try again.' })
    } finally {
      setLoading(false)
      setStatus(undefined)
    }
  }

  const messageEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages])

  useEffect(() => {
    const handleSelectConversation = (event: Event) => {
      const customEvent = event as CustomEvent<{ conversationId: string }>;
      const conversationId = customEvent.detail?.conversationId;
      if (conversationId) {
        loadConversation(conversationId);
      }
    };

    const handleNewConversation = () => {
      stopAudio();
      setCurrentConversationId(null);
      setMessages([]);
    };

    window.addEventListener('ai-chat:select-conversation', handleSelectConversation as EventListener);
    window.addEventListener('ai-chat:new-conversation', handleNewConversation);

    return () => {
      window.removeEventListener('ai-chat:select-conversation', handleSelectConversation as EventListener);
      window.removeEventListener('ai-chat:new-conversation', handleNewConversation);
    };
  }, [USER_ID, stopAudio]);

  const handleSendMessage = (content: string, language?: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      created_at: new Date(),
      language,
    }
    setMessages(prev => [...prev, newMessage])
    handleSend(newMessage, language)
  }

  return (
    <PageShell title='AI Assistant' fixed>
      <MessageList
        messages={messages}
        isLoading={loading}
        status={status}
        initial={initial ?? undefined}
        onSuggestion={(prompt) => handleSendMessage(prompt)}
        onSpeak={voiceEnabled ? handleSpeak : undefined}
        speaking={speaking}
      />
      <ChatInput
        onSendMessage={handleSendMessage}
        disabled={loading}
        voiceEnabled={voiceEnabled}
        voiceLanguage={voiceLanguage}
        onVoiceLanguageChange={setVoiceLanguage}
        accessToken={ACCESS_TOKEN}
      />
    </PageShell>
  )
}

export default Chatbot

import { RegisterOptions } from "module";
import type { LucideIcon } from "lucide-react";
import type { VoiceLanguage } from "@/lib/voice";

declare global {
    type NavItem = {
      name: string;
      icon: React.ReactNode;
      href: string;
    }
    type FormInputProps = {
        name: string;
        label: string;
        value: string;
        placeholder?: string;
        type?: string;
        error?: string;
        validation?: RegisterOptions
        disabled?: boolean; 
    }

    type FooterLinkProps = {
        text: string;
        linkText: string;
        href: string;
    }

    type StatsProps = {
        title: string;
        icon: LucideIcon;
        value: string;
        info: string;
    }

    type ChatInputProps = {
        /** language: reply language code from voice input (e.g. "ta-IN"), undefined for typed text on Auto */
        onSendMessage: (message: string, language?: string) => void
        disabled?: boolean
        voiceEnabled?: boolean
        voiceLanguage?: VoiceLanguage
        onVoiceLanguageChange?: (language: VoiceLanguage) => void
        accessToken?: string
    }

    type MessageListProps = {
        messages: Message[]
        isLoading?: boolean
    }
}

export {}
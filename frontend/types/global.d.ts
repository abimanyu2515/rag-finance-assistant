import { RegisterOptions } from "module";
import type { LucideIcon } from "lucide-react";

declare global {
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
}

export {}
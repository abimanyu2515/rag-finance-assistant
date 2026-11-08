'use client'

import { SessionProvider } from "next-auth/react";
import React from "react";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { Toaster } from "@/components/ui/sonner";

export function Provider({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <ConfirmProvider>
                {children}
                <Toaster />
            </ConfirmProvider>
        </SessionProvider>
    )
}

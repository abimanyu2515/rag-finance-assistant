'use client'
import Sidebar from "@/components/Sidebar"
import React from "react"
import { SidebarProvider } from "@/contexts/SidebarContext"

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <SidebarProvider>
      <div className="flex">
          <Sidebar />
          <main className="flex-1">
              {children}
          </main>
      </div>
    </SidebarProvider>
  )
}

export default RootLayout
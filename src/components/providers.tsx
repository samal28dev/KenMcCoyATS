'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useEffect, useState } from 'react'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as SonnerToaster } from 'sonner'
import { AuthProvider } from '@/providers/auth-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,        // Data considered fresh for 30s
            gcTime: 5 * 60 * 1000,       // Cache garbage collected after 5 min
            refetchOnWindowFocus: true,   // Refetch when user returns to tab
            refetchOnReconnect: true,     // Refetch after network reconnect
            retry: 2,                     // Retry failed queries twice
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
          },
          mutations: {
            retry: 1,
          },
        },
      })
  )

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <div className="min-h-screen bg-background">{children}</div>
        </QueryClientProvider>
      </AuthProvider>
    )
  }

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <SonnerToaster position="top-right" richColors closeButton />
        </ThemeProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </AuthProvider>
  )
}

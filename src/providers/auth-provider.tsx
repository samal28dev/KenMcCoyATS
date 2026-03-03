'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface User {
  _id: string
  name: string
  email: string
  role: string
  avatar?: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (token: string, user: User) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: () => { },
  logout: () => { },
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // With httpOnly cookies, we check session by calling /api/auth/me
    // The browser sends the cookie automatically
    fetchUser()
  }, [])

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' })

      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
        setToken('cookie') // Indicate authenticated (actual token is in httpOnly cookie)
      } else {
        setUser(null)
        setToken(null)
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
      setUser(null)
      setToken(null)
    } finally {
      setIsLoading(false)
    }
  }

  const login = (newToken: string, newUser: User) => {
    // Token is stored as httpOnly cookie by the server.
    // We just update state — no localStorage.
    setToken('cookie')
    setUser(newUser)
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
    } catch { /* best-effort */ }
    setToken(null)
    setUser(null)
    window.location.href = '/sign-in'
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

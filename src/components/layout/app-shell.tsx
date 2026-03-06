'use client'

import { useAuth } from '@/providers/auth-provider'
import { useRealtimeSync } from '@/hooks/use-realtime'
import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import {
  Bell,
  Briefcase,
  Building2,
  ChevronDown,
  FileBarChart2,
  LayoutGrid,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  Users,
  X,
  CheckSquare,
  ListOrdered,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'


const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutGrid },
  { name: 'Clients', href: '/clients', icon: Building2 },
  { name: 'Positions', href: '/positions', icon: Briefcase },
  { name: 'Candidates', href: '/candidates', icon: Users },
  { name: 'Candidate Lists', href: '/candidates/lists', icon: ListOrdered },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Reports', href: '/reports', icon: FileBarChart2 },
  { name: 'Settings', href: '/settings', icon: Settings },
]

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  operations_head: 'Operations Head',
  team_lead: 'Team Lead',
  recruiter: 'Recruiter',
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  operations_head: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  team_lead: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  recruiter: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
}



export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [mounted, setMounted] = useState(false)

  const { user: currentUser, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  // Activate real-time WebSocket sync
  useRealtimeSync()

  useEffect(() => {
    setMounted(true)
    // Store user info for the socket hook to join rooms
    if (currentUser?._id) {
      localStorage.setItem('ats_user_id', currentUser._id)
      localStorage.setItem('ats_user_role', currentUser.role || '')
    }
  }, [currentUser])

  // Fetch notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await apiFetch('/api/notifications?limit=10')
      if (!res.ok) return []
      const data = await res.json()
      return Array.isArray(data) ? data : (data.notifications ?? [])
    },
    enabled: !!currentUser?._id,
    refetchInterval: 60000,
  })

  const unreadCount = (notifications as any[]).filter((n: any) => !n.isRead).length

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    router.push(`/candidates?search=${encodeURIComponent(searchQuery.trim())}`)
    setSearchQuery('')
  }

  const userInitials =
    currentUser?.name
      ?.split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'KM'

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity',
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border transition-transform lg:translate-x-0 flex flex-col shadow-xl',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">KM</span>
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">Ken McCoy</p>
              <p className="text-[10px] text-muted-foreground leading-tight">Consulting ATS</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-md lg:hidden hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 px-3 py-4 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* User profile at bottom */}
        <div className="p-3 border-t border-border shrink-0">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-accent transition-colors">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
              {currentUser?.avatar ? (
                <img
                  src={currentUser.avatar as string}
                  alt={currentUser.name || 'User'}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                userInitials
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{currentUser?.name || 'User'}</p>
              {currentUser?.role && (
                <span
                  className={cn(
                    'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                    ROLE_COLORS[currentUser.role] || 'bg-muted text-muted-foreground'
                  )}
                >
                  {ROLE_LABELS[currentUser.role] || currentUser.role}
                </span>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border">
          <div className="flex h-16 items-center gap-4 px-4 sm:px-6">
            {/* Mobile menu */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-md hover:bg-accent lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Search */}
            <div className="flex-1 flex items-center gap-4">
              <form onSubmit={handleSearch} className="relative max-w-md w-full hidden sm:block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  placeholder="Search candidates, clients, positions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-10 pr-4 text-sm bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                />
              </form>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-1">
              {/* Theme toggle */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-md hover:bg-accent transition-colors"
                title="Toggle theme"
              >
                {mounted && theme === 'dark' ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </button>

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false) }}
                  className="p-2 rounded-md hover:bg-accent relative transition-colors"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                    <div className="absolute right-0 mt-2 w-80 z-50 rounded-xl bg-popover border border-border shadow-xl animate-in fade-in slide-in-from-top-2 max-h-96 overflow-y-auto">
                      <div className="p-3 border-b border-border flex items-center justify-between">
                        <p className="text-sm font-semibold">Notifications</p>
                        {unreadCount > 0 && (
                          <span className="text-xs text-muted-foreground">{unreadCount} unread</span>
                        )}
                      </div>
                      <div className="divide-y divide-border">
                        {(notifications as any[]).length === 0 ? (
                          <div className="p-4 text-center text-sm text-muted-foreground">
                            No notifications
                          </div>
                        ) : (
                          (notifications as any[]).slice(0, 10).map((n: any) => (
                            <div
                              key={n._id}
                              className={cn(
                                'px-3 py-2.5 text-sm hover:bg-accent transition-colors cursor-default',
                                !n.isRead && 'bg-primary/5'
                              )}
                            >
                              <p className="text-sm leading-snug">{n.message}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(n.createdAt).toLocaleString()}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* User menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-colors"
                >
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                    {userInitials}
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
                </button>

                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setUserMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 z-50 rounded-xl bg-popover border border-border shadow-xl animate-in fade-in slide-in-from-top-2">
                      <div className="p-3 border-b border-border">
                        <p className="text-sm font-semibold">{currentUser?.name || 'User'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {currentUser?.email || ''}
                        </p>
                        {currentUser?.role && (
                          <span
                            className={cn(
                              'inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1',
                              ROLE_COLORS[currentUser.role] || 'bg-muted text-muted-foreground'
                            )}
                          >
                            {ROLE_LABELS[currentUser.role] || currentUser.role}
                          </span>
                        )}
                      </div>
                      <div className="p-1">
                        <Link
                          href="/settings"
                          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-accent transition-colors"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Settings className="h-4 w-4" />
                          Settings
                        </Link>
                        <hr className="my-1 border-border" />
                        <button onClick={() => logout()} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-accent w-full text-left text-red-500 transition-colors">
                          <LogOut className="h-4 w-4" />
                          Sign out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
      </div>
    </div>
  )
}

'use client'

import { useAuth } from '@/providers/auth-provider'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { Bell, Database, Palette, Save, Shield, User, UsersRound, Loader2, LogOut, Mail, CheckCircle2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile')
  const { user: currentUser, logout } = useAuth()
  const queryClient = useQueryClient()

  // ---------- PROFILE ----------
  const [profileForm, setProfileForm] = useState({ name: '', email: '', phone: '', department: '' })

  useEffect(() => {
    if (currentUser) {
      setProfileForm({
        name: currentUser.name || '',
        email: currentUser.email || '',
        phone: (currentUser as any).phone || '',
        department: (currentUser as any).department || '',
      })
    }
  }, [currentUser])

  const profileMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiFetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      return res.json()
    },
    onSuccess: () => toast.success('Profile updated successfully'),
    onError: (err: any) => toast.error(err.message || 'Update failed'),
  })

  // ---------- PASSWORD ----------
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })

  const passwordMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Password changed successfully')
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    },
    onError: (err: any) => toast.error(err.message || 'Failed to change password'),
  })

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault()
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (pwForm.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    passwordMutation.mutate({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword })
  }

  // ---------- EMAIL CONFIG ----------
  const [emailForm, setEmailForm] = useState({ outlookEmail: '', outlookPassword: '' })
  const [emailConfigured, setEmailConfigured] = useState(false)

  useEffect(() => {
    if (currentUser) {
      const ec = (currentUser as any).emailConfig
      if (ec) {
        setEmailForm({ outlookEmail: ec.outlookEmail || '', outlookPassword: ec.outlookPassword ? '••••••••' : '' })
        setEmailConfigured(!!ec.isConfigured)
      }
    }
  }, [currentUser])

  const emailConfigMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiFetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailConfig: data }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Outlook email configured successfully')
      setEmailConfigured(true)
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save email config'),
  })

  // ---------- THEME ----------
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    const stored = localStorage.getItem('theme') || 'dark'
    setTheme(stored)
  }, [])

  const applyTheme = (t: string) => {
    setTheme(t)
    localStorage.setItem('theme', t)
    const root = document.documentElement
    if (t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    toast.success(`Theme set to ${t}`)
  }

  // ---------- USER MANAGEMENT ----------
  const isAdmin = ['super_admin', 'superadmin', 'admin', 'operations_head'].includes(currentUser?.role ?? '')

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await apiFetch('/api/users')
      if (!res.ok) return []
      return res.json()
    },
    enabled: activeTab === 'users' && isAdmin,
  })

  const roleUpdateMutation = useMutation({
    mutationFn: async ({ userId, role, isActive }: { userId: string; role?: string; isActive?: boolean }) => {
      const res = await apiFetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role, isActive }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error) }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User updated')
    },
    onError: (err: any) => toast.error(err.message || 'Update failed'),
  })

  // ---------- TABS ----------
  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'email', label: 'Email / Outlook', icon: Mail },
    ...(isAdmin ? [{ id: 'users', label: 'User Management', icon: UsersRound }] : []),
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'data', label: 'Data & Privacy', icon: Database },
  ]

  return (
    <AppShell>
      <div className="min-h-screen">
        <div className="section-padding py-8 border-b border-border/50">
          <div className="container-max">
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your account settings and preferences</p>
          </div>
        </div>

        <div className="section-padding py-8">
          <div className="container-max">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Sidebar */}
              <div className="lg:col-span-1">
                <nav className="space-y-1">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === tab.id
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                        }`}
                    >
                      <tab.icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Content */}
              <div className="lg:col-span-3">

                {/* ========== PROFILE ========== */}
                {activeTab === 'profile' && (
                  <div className="rounded-xl border border-border bg-card p-6">
                    <h2 className="text-lg font-medium mb-6">Profile Information</h2>
                    <form onSubmit={(e) => { e.preventDefault(); profileMutation.mutate({ name: profileForm.name, phone: profileForm.phone, department: profileForm.department }) }}
                      className="space-y-4 max-w-lg">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                        <input type="text" value={profileForm.name}
                          onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                          className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Email</label>
                        <input type="email" value={profileForm.email} disabled
                          className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-muted cursor-not-allowed" />
                        <p className="text-[10px] text-muted-foreground mt-1">Email cannot be changed</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Phone</label>
                        <input type="text" value={profileForm.phone}
                          onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                          className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
                          placeholder="e.g. +91 98765 43210" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Department</label>
                        <input type="text" value={profileForm.department}
                          onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })}
                          className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
                          placeholder="e.g. Operations" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Role</label>
                        <input type="text" value={currentUser?.role?.replace('_', ' ') || ''} disabled
                          className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-muted cursor-not-allowed capitalize" />
                      </div>
                      <button type="submit" disabled={profileMutation.isPending}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                        {profileMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {profileMutation.isPending ? 'Saving...' : 'Save Changes'}
                      </button>
                    </form>
                  </div>
                )}

                {/* ========== EMAIL / OUTLOOK ========== */}
                {activeTab === 'email' && (
                  <div className="rounded-xl border border-border bg-card p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <h2 className="text-lg font-medium">Email / Outlook Configuration</h2>
                      {emailConfigured && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                          <CheckCircle2 className="h-3 w-3" /> Connected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                      Configure your Outlook email to send emails with attachments directly from this tool.
                      Without this, emails will open in your default mail client without attachments.
                    </p>

                    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 p-3 mb-6">
                      <p className="text-xs text-amber-800 dark:text-amber-300 font-medium mb-1">⚠️ Use an App Password, not your regular password</p>
                      <p className="text-[10px] text-amber-700 dark:text-amber-400">
                        For Microsoft 365 / Outlook, generate an App Password:
                        Go to <a href="https://account.microsoft.com/security" target="_blank" className="underline">Microsoft Account Security</a> →
                        Advanced security options → App passwords → Create a new app password.
                      </p>
                    </div>

                    <form onSubmit={(e) => {
                      e.preventDefault()
                      const data = { ...emailForm }
                      // Don't send the masked password if unchanged
                      if (data.outlookPassword === '••••••••') delete (data as any).outlookPassword
                      emailConfigMutation.mutate(data)
                    }} className="space-y-4 max-w-lg">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Outlook Email</label>
                        <input type="email" value={emailForm.outlookEmail}
                          onChange={(e) => setEmailForm({ ...emailForm, outlookEmail: e.target.value })}
                          className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
                          placeholder="you@outlook.com or you@company.com" />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">App Password</label>
                        <input type="password" value={emailForm.outlookPassword}
                          onChange={(e) => setEmailForm({ ...emailForm, outlookPassword: e.target.value })}
                          onFocus={() => { if (emailForm.outlookPassword === '••••••••') setEmailForm({ ...emailForm, outlookPassword: '' }) }}
                          className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
                          placeholder="Your Outlook app password" />
                      </div>
                      <button type="submit" disabled={emailConfigMutation.isPending || !emailForm.outlookEmail}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                        {emailConfigMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {emailConfigMutation.isPending ? 'Saving...' : 'Save Email Config'}
                      </button>
                    </form>
                  </div>
                )}

                {/* ========== SECURITY ========== */}
                {activeTab === 'security' && (
                  <div className="rounded-xl border border-border bg-card p-6">
                    <h2 className="text-lg font-medium mb-6">Change Password</h2>
                    <form onSubmit={handlePasswordChange} className="space-y-4 max-w-lg">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Current Password</label>
                        <input type="password" value={pwForm.currentPassword}
                          onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                          className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" required />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">New Password</label>
                        <input type="password" value={pwForm.newPassword}
                          onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                          className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" required minLength={6} />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Confirm New Password</label>
                        <input type="password" value={pwForm.confirmPassword}
                          onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                          className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background" required minLength={6} />
                      </div>
                      <button type="submit" disabled={passwordMutation.isPending}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                        {passwordMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                        {passwordMutation.isPending ? 'Updating...' : 'Update Password'}
                      </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-border">
                      <h3 className="text-sm font-medium mb-2">Active Sessions</h3>
                      <p className="text-xs text-muted-foreground mb-3">You are currently logged in.</p>
                      <button onClick={() => { if (confirm('Sign out of all sessions?')) logout() }}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10">
                        <LogOut className="h-4 w-4" /> Sign Out
                      </button>
                    </div>
                  </div>
                )}

                {/* ========== APPEARANCE ========== */}
                {activeTab === 'appearance' && (
                  <div className="rounded-xl border border-border bg-card p-6">
                    <h2 className="text-lg font-medium mb-6">Appearance</h2>
                    <p className="text-sm text-muted-foreground mb-4">Select a theme for the interface</p>
                    <div className="grid grid-cols-3 gap-3 max-w-md">
                      {[
                        { key: 'light', label: 'Light', desc: 'Clean white background' },
                        { key: 'dark', label: 'Dark', desc: 'Easy on the eyes' },
                        { key: 'system', label: 'System', desc: 'Follows your OS' },
                      ].map((t) => (
                        <button key={t.key} onClick={() => applyTheme(t.key)}
                          className={`p-4 rounded-xl border text-left transition-colors ${theme === t.key
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/30'
                            }`}>
                          <p className="text-sm font-medium">{t.label}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{t.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ========== NOTIFICATIONS ========== */}
                {activeTab === 'notifications' && (
                  <NotificationPreferences />
                )}

                {/* ========== DATA & PRIVACY ========== */}
                {activeTab === 'data' && (
                  <div className="rounded-xl border border-border bg-card p-6">
                    <h2 className="text-lg font-medium mb-6">Data & Privacy</h2>
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-sm font-medium mb-2">Export Your Data</h3>
                        <p className="text-xs text-muted-foreground mb-3">
                          Download all your data (candidates, clients, positions) as Excel reports from the Reports page.
                        </p>
                        <a href="/reports"
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors">
                          Go to Reports →
                        </a>
                      </div>
                      <div className="pt-6 border-t border-border">
                        <h3 className="text-sm font-medium mb-2">Account Info</h3>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>Email: {currentUser?.email}</p>
                          <p>Role: {currentUser?.role?.replace('_', ' ')}</p>
                          <p>User ID: {currentUser?._id}</p>
                        </div>
                      </div>
                      <div className="pt-6 border-t border-border">
                        <h3 className="text-sm font-medium mb-2 text-red-600 dark:text-red-400">Danger Zone</h3>
                        <p className="text-xs text-muted-foreground mb-3">
                          Sign out of your account. Your data is preserved in the database.
                        </p>
                        <button onClick={() => { if (confirm('Are you sure you want to sign out?')) logout() }}
                          className="px-4 py-2 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700 transition-colors">
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ========== USER MANAGEMENT ========== */}
                {activeTab === 'users' && (
                  <div className="rounded-xl border border-border bg-card p-6">
                    <h2 className="text-lg font-medium mb-6">User Management</h2>
                    {!isAdmin ? (
                      <p className="text-sm text-muted-foreground">Only Operations Head and Admin can manage users.</p>
                    ) : (
                      <div className="space-y-1">
                        <div className="grid grid-cols-12 gap-3 px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border">
                          <div className="col-span-3">Name</div>
                          <div className="col-span-3">Email</div>
                          <div className="col-span-2">Role</div>
                          <div className="col-span-2">Status</div>
                          <div className="col-span-2">Actions</div>
                        </div>
                        {users.map((u: any) => (
                          <div key={u._id} className="grid grid-cols-12 gap-3 items-center px-3 py-3 rounded-lg hover:bg-muted/30 transition-colors">
                            <div className="col-span-3">
                              <p className="text-sm font-medium">{u.name}</p>
                            </div>
                            <div className="col-span-3">
                              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                            </div>
                            <div className="col-span-2">
                              <Select
                                value={u.role}
                                onValueChange={(val) => roleUpdateMutation.mutate({ userId: u._id, role: val })}
                                disabled={u._id === currentUser?._id}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="recruiter">Recruiter</SelectItem>
                                    <SelectItem value="team_lead">Team Lead</SelectItem>
                                    <SelectItem value="operations_head">Ops Head</SelectItem>
                                    {currentUser?.role === 'super_admin' && <SelectItem value="super_admin">Super Admin</SelectItem>}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                {u.isActive !== false ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <div className="col-span-2">
                              {u._id !== currentUser?._id && (
                                <button
                                  onClick={() => roleUpdateMutation.mutate({ userId: u._id, isActive: u.isActive === false })}
                                  className="text-xs px-2 py-1 border border-border rounded hover:bg-muted transition-colors"
                                >
                                  {u.isActive !== false ? 'Deactivate' : 'Activate'}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                        {users.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-8">No users found</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

// ── Notification Preferences sub-component — persisted to DB via profile API ──
const DEFAULT_PREFS = {
  statusChanges: true,
  comments: true,
  assignments: true,
  agreements: true,
}

function NotificationPreferences() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    apiFetch('/api/auth/me').then(res => res.json()).then((u: any) => {
      if (u?.user?.notificationPreferences) setPrefs({ ...DEFAULT_PREFS, ...u.user.notificationPreferences })
    }).catch(() => {}).finally(() => setLoaded(true))
  }, [])

  const toggle = async (key: keyof typeof DEFAULT_PREFS) => {
    const updated = { ...prefs, [key]: !prefs[key] }
    setPrefs(updated)
    try {
      await apiFetch('/api/auth/profile', { method: 'PATCH', body: JSON.stringify({ notificationPreferences: updated }) })
    } catch { /* optimistic UI – revert on failure */ setPrefs(prefs); toast.error('Failed to save preference'); return }
    toast.success(`${key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())} notifications ${updated[key] ? 'enabled' : 'disabled'}`)
  }

  const items = [
    { key: 'statusChanges' as const, label: 'Status Change Alerts', desc: 'When a candidate status is updated in your scope', color: 'blue' },
    { key: 'comments' as const, label: 'Comment Mentions', desc: 'When someone @mentions you in a comment', color: 'purple' },
    { key: 'assignments' as const, label: 'Assignment Notifications', desc: 'When a candidate or position is assigned to you', color: 'orange' },
    { key: 'agreements' as const, label: 'Agreement Expiry', desc: '30-day alerts before client agreements expire', color: 'yellow' },
  ]

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-medium mb-6">Notification Preferences</h2>
      <p className="text-xs text-muted-foreground mb-4">
        Toggle which in-app notifications you receive. Changes are saved automatically.
      </p>
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.key} className="rounded-lg border border-border p-4">
            <div className="flex items-center gap-3">
              <div className={`h-8 w-8 rounded-lg bg-${item.color}-50 dark:bg-${item.color}-900/20 flex items-center justify-center`}>
                <Bell className={`h-4 w-4 text-${item.color}-600`} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <button
                onClick={() => toggle(item.key)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${prefs[item.key] ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${prefs[item.key] ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

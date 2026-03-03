'use client'

import { useQuery } from '@tanstack/react-query'
import {
    Building2,
    Briefcase,
    Users,
    AlertTriangle,
    TrendingUp,
    Clock,
    Plus,
    ArrowRight,
    CheckCircle2,
    UserPlus,
} from 'lucide-react'
import Link from 'next/link'
import { AppShell } from '@/components/layout/app-shell'
import { apiFetch } from '@/lib/api'

function cn(...classes: (string | undefined | boolean)[]) {
    return classes.filter(Boolean).join(' ')
}

export default function DashboardPage() {
    const { data: stats } = useQuery({
        queryKey: ['analytics'],
        queryFn: async () => {
            const res = await apiFetch('/api/analytics')
            return res.json()
        },
        retry: false,
        refetchInterval: 30 * 1000,  // Auto-refresh every 30s for multi-user
    })

    const expiringAgreements = stats?.expiringAgreements ?? []
    const pipelineStats = stats?.pipelineStats ?? {}

    const statCards = [
        {
            label: 'Active Clients',
            value: stats?.activeClients ?? 0,
            icon: Building2,
            color: 'text-blue-600',
            bg: 'bg-blue-50 dark:bg-blue-900/20',
            href: '/clients',
        },
        {
            label: 'Open Positions',
            value: stats?.openPositions ?? 0,
            icon: Briefcase,
            color: 'text-purple-600',
            bg: 'bg-purple-50 dark:bg-purple-900/20',
            href: '/positions',
        },
        {
            label: 'Total Candidates',
            value: stats?.totalCandidates ?? 0,
            icon: Users,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50 dark:bg-emerald-900/20',
            href: '/candidates',
        },
        {
            label: 'Joined This Month',
            value: pipelineStats?.joined ?? 0,
            icon: CheckCircle2,
            color: 'text-green-600',
            bg: 'bg-green-50 dark:bg-green-900/20',
            href: '/candidates',
        },
    ]

    const quickActions = [
        { label: 'Add Client', href: '/clients', icon: Building2 },
        { label: 'Create Position', href: '/positions', icon: Briefcase },
        { label: 'Add Candidate', href: '/candidates', icon: UserPlus },
        { label: 'View Reports', href: '/reports', icon: TrendingUp },
    ]

    return (
        <AppShell>
            <div className="min-h-screen">
                {/* Header */}
                <div className="border-b border-border/50 bg-background">
                    <div className="px-6 py-6 max-w-7xl mx-auto">
                        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            Ken McCoy Consulting — Recruitment Operations
                        </p>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {statCards.map((card) => (
                            <Link key={card.label} href={card.href}>
                                <div className={cn('rounded-xl p-5 border border-border hover:shadow-md transition-all cursor-pointer', card.bg)}>
                                    <div className="flex items-center justify-between mb-3">
                                        <card.icon className={cn('h-5 w-5', card.color)} />
                                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <p className="text-2xl font-bold">{card.value}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
                                </div>
                            </Link>
                        ))}
                    </div>

                    {/* Expiring Agreements Alert */}
                    {expiringAgreements.length > 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800/40 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                                    Expiring Agreements ({expiringAgreements.length})
                                </h3>
                            </div>
                            <div className="space-y-1">
                                {expiringAgreements.slice(0, 3).map((client: any) => (
                                    <Link key={client._id} href={`/clients/${client._id}`}>
                                        <p className="text-sm text-amber-700 dark:text-amber-300 hover:underline">
                                            {client.companyName} — expires {new Date(client.agreementValidTill).toLocaleDateString()}
                                        </p>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Pipeline Overview */}
                        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
                            <h2 className="text-sm font-semibold mb-4">Pipeline Overview</h2>
                            {Object.keys(pipelineStats).length > 0 ? (
                                <div className="space-y-3">
                                    {Object.entries(pipelineStats).map(([status, count]: [string, any]) => {
                                        const total = Object.values(pipelineStats as Record<string, number>).reduce((a: number, b: number) => a + b, 0)
                                        const pct = total > 0 ? (count / total) * 100 : 0
                                        const colors: Record<string, string> = {
                                            new: 'bg-blue-500',
                                            screening: 'bg-indigo-500',
                                            shortlisted: 'bg-purple-500',
                                            interview: 'bg-yellow-500',
                                            offered: 'bg-orange-500',
                                            joined: 'bg-green-500',
                                            rejected: 'bg-gray-400',
                                        }
                                        return (
                                            <div key={status}>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="capitalize text-muted-foreground">{status.replace('_', ' ')}</span>
                                                    <span className="font-medium">{count as number}</span>
                                                </div>
                                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className={cn('h-full rounded-full transition-all', colors[status] || 'bg-primary')}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className="h-6 bg-muted/30 rounded animate-pulse" />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Quick Actions */}
                        <div className="rounded-xl border border-border bg-card p-5">
                            <h2 className="text-sm font-semibold mb-4">Quick Actions</h2>
                            <div className="space-y-2">
                                {quickActions.map((action) => (
                                    <Link key={action.label} href={action.href}>
                                        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors cursor-pointer">
                                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                <action.icon className="h-4 w-4 text-primary" />
                                            </div>
                                            <span className="text-sm font-medium">{action.label}</span>
                                            <Plus className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="rounded-xl border border-border bg-card p-5">
                        <h2 className="text-sm font-semibold mb-4">Recent Activity</h2>
                        {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                            <div className="space-y-3">
                                {stats.recentActivity.map((activity: any) => (
                                    <div key={activity._id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                                        <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-sm">{activity.action?.replace('_', ' ')}: {activity.target?.name}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {activity.actor?.name} · {new Date(activity.timestamp).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No recent activity</p>
                        )}
                    </div>
                </div>
            </div>
        </AppShell>
    )
}

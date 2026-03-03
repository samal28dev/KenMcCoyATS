'use client'

import { useQuery } from '@tanstack/react-query'
import { Building2, ArrowLeft, MapPin, FileText, Calendar, Mail } from 'lucide-react'
import Link from 'next/link'
import { use, useState } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { apiFetch } from '@/lib/api'
import { CommentsWidget } from '@/components/comments-widget'
import { EmailComposeModal } from '@/components/email-compose-modal'

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [emailOpen, setEmailOpen] = useState(false)

    const { data: client } = useQuery({
        queryKey: ['client', id],
        queryFn: async () => {
            const res = await apiFetch(`/api/clients/${id}`)
            return res.json()
        },
    })

    if (!client) {
        return <AppShell><div className="flex items-center justify-center min-h-screen"><p>Loading...</p></div></AppShell>
    }

    return (
        <AppShell>
            <div className="min-h-screen">
                <div className="border-b border-border/50 bg-background">
                    <div className="px-6 py-6 max-w-7xl mx-auto">
                        <Link href="/clients" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-3">
                            <ArrowLeft className="h-3 w-3" /> Back to Clients
                        </Link>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                    <Building2 className="h-6 w-6 text-blue-600" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-semibold">{client.companyName}</h1>
                                    <p className="text-sm text-muted-foreground">{client.gstin} · {client.locationType}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setEmailOpen(true)}
                                    className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted transition-colors flex items-center gap-1.5">
                                    <Mail className="h-3.5 w-3.5" /> Email
                                </button>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${client.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                    {client.status}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Overview */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="rounded-xl border border-border bg-card p-5">
                            <h2 className="text-sm font-semibold mb-4">Address</h2>
                            <div className="flex items-start gap-2 text-sm text-muted-foreground">
                                <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                                <span>{client.address?.line1}, {client.address?.city}, {client.address?.state} {client.address?.pin}</span>
                            </div>
                        </div>

                        <div className="rounded-xl border border-border bg-card p-5">
                            <h2 className="text-sm font-semibold mb-4">Positions ({client.positions?.length || 0})</h2>
                            {client.positions?.length > 0 ? (
                                <div className="space-y-2">
                                    {client.positions.map((pos: any) => (
                                        <Link key={pos._id} href={`/positions/${pos._id}`}>
                                            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-sm font-medium">{pos.title}</span>
                                                </div>
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${pos.status === 'new' ? 'bg-blue-100 text-blue-700' : pos.status === 'work-in-progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                                                    {pos.status}
                                                </span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No positions yet</p>
                            )}
                        </div>

                        {/* Comments */}
                        <CommentsWidget entityType="client" entityId={id} />
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        <div className="rounded-xl border border-border bg-card p-5">
                            <h2 className="text-sm font-semibold mb-4">Agreement</h2>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>Start: {client.agreementDate ? new Date(client.agreementDate).toLocaleDateString() : 'N/A'}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Calendar className="h-3.5 w-3.5" />
                                    <span>Valid till: {client.agreementValidTill ? new Date(client.agreementValidTill).toLocaleDateString() : 'N/A'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl border border-border bg-card p-5">
                            <h2 className="text-sm font-semibold mb-4">Contacts</h2>
                            {client.contacts?.length > 0 ? (
                                <div className="space-y-3">
                                    {client.contacts.map((c: any, i: number) => (
                                        <div key={i} className="text-sm p-2 rounded-lg hover:bg-muted/50 transition-colors">
                                            <p className="font-medium">{c.name}</p>
                                            <p className="text-xs text-muted-foreground">{c.designation}</p>
                                            <div className="flex flex-col gap-0.5 mt-1">
                                                {c.email && (
                                                    <a href={`mailto:${c.email}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                                                        <Mail className="h-3 w-3" /> {c.email}
                                                    </a>
                                                )}
                                                {c.mobile && (
                                                    <a href={`tel:${c.mobile}`} className="text-xs text-primary hover:underline">
                                                        📱 {c.mobile}
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No contacts</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Email Modal */}
            <EmailComposeModal
                isOpen={emailOpen}
                onClose={() => setEmailOpen(false)}
                defaultTo={client.contacts?.[0]?.email || ''}
                defaultSubject={`Regarding ${client.companyName}`}
                clientId={id}
            />
        </AppShell>
    )
}

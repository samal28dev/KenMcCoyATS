'use client'

import { apiFetch } from '@/lib/api'
import { FileDown, Shield, Stamp, ArrowRightLeft, ChevronDown, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface DocumentActionsProps {
    filename: string
    type: 'resume' | 'jd'       // determines which actions to show
    className?: string
}

const actions = {
    resume: [
        { key: 'watermark', label: 'Add Watermark (KMC)', icon: Stamp, description: 'Header, footer & diagonal watermark' },
        { key: 'removePii', label: 'Remove PII', icon: Shield, description: 'Strip email & phone numbers' },
        { key: 'convertToDocx', label: 'Convert to DOCX', icon: ArrowRightLeft, description: 'PDF → Word format', pdfOnly: true },
        { key: 'convertToPdf', label: 'Convert to PDF', icon: ArrowRightLeft, description: 'Word → PDF format', docxOnly: true },
    ],
    jd: [
        { key: 'removeCTC', label: 'Remove CTC / Budget', icon: Shield, description: 'Strip salary & compensation info' },
        { key: 'convertToDocx', label: 'Convert to DOCX', icon: ArrowRightLeft, description: 'PDF → Word format', pdfOnly: true },
        { key: 'convertToPdf', label: 'Convert to PDF', icon: ArrowRightLeft, description: 'Word → PDF format', docxOnly: true },
    ],
}

export function DocumentActions({ filename, type, className }: DocumentActionsProps) {
    const [open, setOpen] = useState(false)
    const [processing, setProcessing] = useState<string | null>(null)

    const isPdf = filename.toLowerCase().endsWith('.pdf')
    const isDocx = filename.toLowerCase().endsWith('.docx') || filename.toLowerCase().endsWith('.doc')

    const availableActions = actions[type].filter(a => {
        if (a.pdfOnly && !isPdf) return false
        if (a.docxOnly && !isDocx) return false
        return true
    })

    const handleAction = async (actionKey: string) => {
        setProcessing(actionKey)
        try {
            const res = await apiFetch('/api/documents/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename, actions: [actionKey] }),
            })

            if (!res.ok) throw new Error('Processing failed')

            const data = await res.json()
            toast.success('Document processed successfully')

            // Auto-download the first result
            const downloadUrls = data.downloadUrls || {}
            const firstUrl = Object.values(downloadUrls)[0] as string
            if (firstUrl) {
                window.open(firstUrl, '_blank')
            }
        } catch {
            toast.error('Failed to process document')
        } finally {
            setProcessing(null)
            setOpen(false)
        }
    }

    return (
        <div className={`relative inline-block ${className || ''}`}>
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted/50 transition-colors"
            >
                <FileDown className="h-3.5 w-3.5 text-muted-foreground" />
                Process Document
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-64 bg-background rounded-lg border border-border shadow-lg z-50">
                        <div className="p-1.5">
                            {availableActions.map((action) => {
                                const Icon = action.icon
                                const isProcessing = processing === action.key
                                return (
                                    <button
                                        key={action.key}
                                        onClick={() => handleAction(action.key)}
                                        disabled={!!processing}
                                        className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-md hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
                                    >
                                        {isProcessing ? (
                                            <Loader2 className="h-4 w-4 text-primary animate-spin mt-0.5 shrink-0" />
                                        ) : (
                                            <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                        )}
                                        <div>
                                            <p className="text-xs font-medium">{action.label}</p>
                                            <p className="text-[10px] text-muted-foreground">{action.description}</p>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

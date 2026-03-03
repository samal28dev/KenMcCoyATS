'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import { Mail, X, FileText, ChevronDown, Paperclip, Shield, Stamp, AlertTriangle, Files } from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

interface EmailComposeModalProps {
    isOpen: boolean
    onClose: () => void
    defaultTo?: string
    defaultSubject?: string
    candidateId?: string
    clientId?: string
    positionId?: string
    resumeFile?: string        // candidate's resume filename
    jdFile?: string            // position's JD filename
}

export function EmailComposeModal({
    isOpen, onClose, defaultTo, defaultSubject, candidateId, clientId, positionId,
    resumeFile, jdFile
}: EmailComposeModalProps) {
    const [to, setTo] = useState(defaultTo || '')
    const [cc, setCc] = useState('')
    const [bcc, setBcc] = useState('')
    const [subject, setSubject] = useState(defaultSubject || '')
    const [content, setContent] = useState('')
    const [selectedTemplateId, setSelectedTemplateId] = useState('')
    const [showTemplates, setShowTemplates] = useState(false)
    const [showCcBcc, setShowCcBcc] = useState(false)

    // Attachment management
    const [attachResume, setAttachResume] = useState(false)
    const [attachJd, setAttachJd] = useState(false)
    const [watermark, setWatermark] = useState(false)
    const [removePii, setRemovePii] = useState(false)
    const [removeCTC, setRemoveCTC] = useState(false)
    const [attachBothFormats, setAttachBothFormats] = useState(false)

    useEffect(() => {
        if (defaultTo) setTo(defaultTo)
        if (defaultSubject) setSubject(defaultSubject)
    }, [defaultTo, defaultSubject])

    const { data: templates = [] } = useQuery({
        queryKey: ['email-templates'],
        queryFn: async () => {
            const res = await apiFetch('/api/email-templates')
            return res.json()
        },
        enabled: isOpen,
    })

    const sendMutation = useMutation({
        mutationFn: async () => {
            // Build attachment list
            const attachmentFilenames: string[] = []
            if (attachResume && resumeFile) attachmentFilenames.push(resumeFile)
            if (attachJd && jdFile) attachmentFilenames.push(jdFile)

            const res = await apiFetch('/api/emails/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to,
                    cc: cc || undefined,
                    bcc: bcc || undefined,
                    subject,
                    content,
                    templateId: selectedTemplateId || undefined,
                    candidateId, clientId, positionId,
                    attachmentFilenames: attachmentFilenames.length > 0 ? attachmentFilenames : undefined,
                    processActions: {
                        watermark: watermark,
                        removePii: removePii,
                        removeCTC: removeCTC,
                        attachBothFormats: attachBothFormats,
                    },
                }),
            })
            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || 'Failed to send email')
            }
            return res.json()
        },
        onSuccess: (data) => {
            if (data.method === 'smtp' && data.success) {
                // Email sent directly via SMTP with attachments
                toast.success(data.message || 'Email sent successfully!', { duration: 5000 })
            } else if (data.method === 'mailto') {
                // Fallback to mailto — no attachments
                toast.warning(
                    'Outlook SMTP not configured. Email opened in your mail client WITHOUT attachments. Configure in Settings → Email / Outlook.',
                    { duration: 8000 }
                )
                if (data.mailtoLink) {
                    window.open(data.mailtoLink, '_self')
                }
            }
            onClose()
            resetForm()
        },
        onError: (err: any) => toast.error(err.message || 'Failed to send email'),
    })

    const resetForm = () => {
        setTo(''); setCc(''); setBcc(''); setSubject(''); setContent('')
        setSelectedTemplateId(''); setShowCcBcc(false)
        setAttachResume(false); setAttachJd(false)
        setWatermark(false); setRemovePii(false); setRemoveCTC(false); setAttachBothFormats(false)
    }

    const applyTemplate = (template: any) => {
        setSubject(template.subject)
        setContent(template.content)
        setSelectedTemplateId(template._id)
        setShowTemplates(false)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-background rounded-xl border border-border shadow-xl w-full max-w-2xl m-4 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <h2 className="text-sm font-semibold">Compose Email</h2>
                    </div>
                    <button onClick={() => { onClose(); resetForm() }} className="p-1 rounded hover:bg-muted transition-colors">
                        <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Template Selector */}
                    <div className="relative">
                        <button
                            onClick={() => setShowTemplates(!showTemplates)}
                            className="flex items-center gap-2 px-3 py-2 text-xs border border-border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                            {selectedTemplateId ? 'Template applied ✓' : 'Use a template'}
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        </button>
                        {showTemplates && (
                            <div className="absolute top-full left-0 mt-1 w-72 bg-background rounded-lg border border-border shadow-lg z-10 max-h-48 overflow-y-auto">
                                {templates.length > 0 ? templates.map((t: any) => (
                                    <button
                                        key={t._id}
                                        onClick={() => applyTemplate(t)}
                                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0"
                                    >
                                        <p className="font-medium text-xs">{t.name}</p>
                                        <p className="text-[10px] text-muted-foreground truncate">{t.subject}</p>
                                    </button>
                                )) : (
                                    <p className="px-3 py-3 text-xs text-muted-foreground">No templates available</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* To */}
                    <div>
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-muted-foreground">To *</label>
                            {!showCcBcc && (
                                <button onClick={() => setShowCcBcc(true)} className="text-[10px] text-primary hover:underline">
                                    Add CC / BCC
                                </button>
                            )}
                        </div>
                        <input
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            placeholder="recipient@example.com"
                            className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                    </div>

                    {/* CC / BCC */}
                    {showCcBcc && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">CC</label>
                                <input value={cc} onChange={(e) => setCc(e.target.value)}
                                    placeholder="cc@example.com"
                                    className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary/30" />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">BCC</label>
                                <input value={bcc} onChange={(e) => setBcc(e.target.value)}
                                    placeholder="bcc@example.com"
                                    className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary/30" />
                            </div>
                        </div>
                    )}

                    {/* Subject */}
                    <div>
                        <label className="text-xs font-medium text-muted-foreground">Subject *</label>
                        <input value={subject} onChange={(e) => setSubject(e.target.value)}
                            placeholder="Email subject"
                            className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary/30" />
                    </div>

                    {/* Content */}
                    <div>
                        <label className="text-xs font-medium text-muted-foreground">Message *</label>
                        <textarea value={content} onChange={(e) => setContent(e.target.value)}
                            rows={8} placeholder="Write your message..."
                            className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-background resize-y focus:outline-none focus:ring-1 focus:ring-primary/30" />
                    </div>

                    {/* Attachments Section */}
                    {(resumeFile || jdFile) && (
                        <div className="rounded-lg border border-border p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs font-semibold">Attachments & Document Processing</span>
                            </div>

                            {/* Resume */}
                            {resumeFile && (
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={attachResume} onChange={() => setAttachResume(!attachResume)}
                                            className="rounded border-border" />
                                        <span className="text-xs font-medium">Attach Resume</span>
                                        <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">({resumeFile})</span>
                                    </label>
                                    {attachResume && (
                                        <div className="ml-6 flex flex-wrap gap-2">
                                            <button onClick={() => setWatermark(!watermark)}
                                                className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded-md border transition-colors ${watermark ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:bg-muted'
                                                    }`}>
                                                <Stamp className="h-3 w-3" /> Add KMC Watermark
                                            </button>
                                            <button onClick={() => setRemovePii(!removePii)}
                                                className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded-md border transition-colors ${removePii ? 'bg-red-500/10 border-red-500/30 text-red-600' : 'border-border text-muted-foreground hover:bg-muted'
                                                    }`}>
                                                <Shield className="h-3 w-3" /> Remove Email & Phone
                                            </button>
                                            <button onClick={() => setAttachBothFormats(!attachBothFormats)}
                                                className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded-md border transition-colors ${attachBothFormats ? 'bg-blue-500/10 border-blue-500/30 text-blue-600' : 'border-border text-muted-foreground hover:bg-muted'
                                                    }`}>
                                                <Files className="h-3 w-3" /> Attach PDF + DOCX
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* JD */}
                            {jdFile && (
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={attachJd} onChange={() => setAttachJd(!attachJd)}
                                            className="rounded border-border" />
                                        <span className="text-xs font-medium">Attach Job Description</span>
                                        <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">({jdFile})</span>
                                    </label>
                                    {attachJd && (
                                        <div className="ml-6 flex flex-wrap gap-2">
                                            <button onClick={() => setRemoveCTC(!removeCTC)}
                                                className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded-md border transition-colors ${removeCTC ? 'bg-red-500/10 border-red-500/30 text-red-600' : 'border-border text-muted-foreground hover:bg-muted'
                                                    }`}>
                                                <Shield className="h-3 w-3" /> Remove CTC / Budget
                                            </button>
                                            <button onClick={() => setAttachBothFormats(!attachBothFormats)}
                                                className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded-md border transition-colors ${attachBothFormats ? 'bg-blue-500/10 border-blue-500/30 text-blue-600' : 'border-border text-muted-foreground hover:bg-muted'
                                                    }`}>
                                                <Files className="h-3 w-3" /> Attach PDF + DOCX
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50">
                                <AlertTriangle className="h-3 w-3 text-amber-500" />
                                <p className="text-[10px] text-muted-foreground">
                                    Attachments require Outlook SMTP configured in Settings → Email / Outlook
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-4 border-t border-border">
                    <p className="text-[10px] text-muted-foreground">
                        Sends via Outlook SMTP · Falls back to mail client if not configured
                    </p>
                    <div className="flex gap-2">
                        <button onClick={() => { onClose(); resetForm() }}
                            className="px-4 py-2 text-xs border border-border rounded-lg hover:bg-muted transition-colors">
                            Cancel
                        </button>
                        <button
                            onClick={() => sendMutation.mutate()}
                            disabled={!to || !subject || !content || sendMutation.isPending}
                            className="px-4 py-2 text-xs bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                        >
                            <Mail className="h-3.5 w-3.5" />
                            {sendMutation.isPending ? 'Sending...' : 'Send Email'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

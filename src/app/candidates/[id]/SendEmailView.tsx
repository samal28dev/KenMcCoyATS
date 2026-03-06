import React, { useState, useRef } from 'react'
import { ArrowLeft, Send, Check, X, ChevronDown, Plus, Info, Video, Forward, FileText, Mail, Loader2, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'

export function SendEmailView({ candidate, onBack }: { candidate: any, onBack: () => void }) {
    const [isSending, setIsSending] = useState(false)
    const [isParsingJD, setIsParsingJD] = useState(false)
    const [proceedMode, setProceedMode] = useState('new')
    const jdFileInputRef = useRef<HTMLInputElement>(null)

    // Form state
    const [formData, setFormData] = useState({
        designation: '',
        workMode: 'office',
        skills: candidate.skills?.join(', ') || '',
        minExp: '',
        maxExp: '',
        location: candidate.location || '',
        minSalary: '',
        maxSalary: '',
        hideSalary: false,
        jd: `Role & responsibilities:\n\nPreferred candidate profile:\n\nPerks and benefits:`,
        teamEmails: [] as string[],
    })
    const [emailInput, setEmailInput] = useState('')

    const addEmail = (email: string) => {
        const trimmed = email.trim().replace(/,$/, '')
        if (!trimmed) return

        // Basic email validation
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            toast.error('Invalid email format')
            return
        }

        if (formData.teamEmails.length >= 5) {
            toast.error('Maximum 5 team members allowed')
            return
        }

        if (formData.teamEmails.includes(trimmed)) {
            setEmailInput('')
            return
        }

        setFormData(prev => ({
            ...prev,
            teamEmails: [...prev.teamEmails, trimmed]
        }))
        setEmailInput('')
    }

    const removeEmail = (index: number) => {
        setFormData(prev => ({
            ...prev,
            teamEmails: prev.teamEmails.filter((_, i) => i !== index)
        }))
    }

    const handleEmailKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            addEmail(emailInput)
        }
    }

    // Document processing actions
    const [actions, setActions] = useState({
        watermark: true,
        removePii: true,
        removeCTC: true,
        attachBothFormats: false,
    })

    const handleJDUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsParsingJD(true)
        const toastId = toast.loading('Parsing job description...')

        try {
            const formDataUpload = new FormData()
            formDataUpload.append('file', file)

            const response = await fetch('/api/parse-jd', {
                method: 'POST',
                headers: {
                    'x-requested-with': 'XMLHttpRequest'
                },
                body: formDataUpload,
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Failed to parse JD')
            }

            const data = result.data
            if (data) {
                setFormData(prev => ({
                    ...prev,
                    designation: data.title || prev.designation,
                    skills: data.skills?.length ? data.skills.join(', ') : prev.skills,
                    minExp: data.minExperience?.toString() || prev.minExp,
                    maxExp: data.maxExperience?.toString() || prev.maxExp,
                    location: data.location || prev.location,
                    jd: `Role & responsibilities:
${data.responsibilities?.length ? '• ' + data.responsibilities.join('\n• ') : data.description || ''}

Preferred candidate profile:
${data.requirements?.length ? '• ' + data.requirements.join('\n• ') : ''}

Perks and benefits:
${data.budget ? 'Salary: ' + data.budget : ''}`,
                }))
                toast.success('JD details parsed and filled!', { id: toastId })
            }
        } catch (error: any) {
            console.error('[JD Upload Client Error]:', {
                message: error.message,
                error
            })
            toast.error(error.message || 'Error parsing job description', { id: toastId })
        } finally {
            setIsParsingJD(false)
            if (jdFileInputRef.current) jdFileInputRef.current.value = ''
        }
    }

    const handleSend = async () => {
        if (!formData.designation) {
            toast.error('Designation is required')
            return
        }

        setIsSending(true)
        try {
            const payload = {
                to: candidate.email || '',
                subject: `Job Opportunity: ${formData.designation} at Ken McCoy Consulting`,
                content: `
Designation: ${formData.designation}
Work Mode: ${formData.workMode}
Skills: ${formData.skills}
Experience: ${formData.minExp} - ${formData.maxExp} years
Location: ${formData.location}
Salary: ${formData.hideSalary ? 'Best in industry' : `₹${formData.minSalary} - ${formData.maxSalary} Lacs`}

${formData.jd}
                `.trim(),
                candidateId: candidate._id,
                attachmentFilenames: [candidate.resumePdfVersion || candidate.resumeFile].filter(Boolean),
                processActions: {
                    watermark: actions.watermark,
                    removePii: actions.removePii,
                    removeCTC: actions.removeCTC,
                    attachBothFormats: actions.attachBothFormats,
                }
            }

            const response = await fetch('/api/emails/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-requested-with': 'XMLHttpRequest'
                },
                body: JSON.stringify(payload),
            })

            const result = await response.json()

            if (result.success) {
                toast.success(result.message || 'invite sent successfully!')
                onBack()
            } else if (result.method === 'mailto') {
                toast.info('SMTP not configured. Opening your mail client...')
                window.location.href = result.mailtoLink
            } else {
                toast.error(result.error || 'Failed to send invite')
            }
        } catch (error) {
            console.error('Send error:', error)
            toast.error('An error occurred while sending the invite')
        } finally {
            setIsSending(false)
        }
    }

    return (
        <div className="bg-[#f3f6f9] min-h-screen">
            <div className="bg-card border-b border-border shadow-sm mb-6">
                <div className="max-w-[1000px] mx-auto flex items-center gap-2 px-4 py-3 text-[14px] text-muted-foreground">
                    <button onClick={onBack} className="flex items-center gap-1 hover:text-foreground">
                        <ArrowLeft className="w-4 h-4" /> Back to Profile
                    </button>
                    <span>{'>'}</span>
                    <span className="font-medium text-foreground">{candidate.name}</span>
                    <span>{'>'}</span>
                    <span>Compose details</span>
                </div>
            </div>

            <div className="max-w-[1000px] mx-auto px-4 pb-20 space-y-6">
                {/* Section 1: How would you like to proceed? */}
                <div className="bg-card rounded-lg border border-border shadow-sm p-8">
                    <h2 className="text-[20px] font-bold text-foreground mb-6">How would you like to proceed?</h2>
                    <RadioGroup value={proceedMode} onValueChange={setProceedMode} className="grid grid-cols-2 gap-8">
                        <div className="flex items-start gap-4">
                            <RadioGroupItem value="new" id="new" className="mt-1" />
                            <Label htmlFor="new" className="flex flex-col gap-1 cursor-pointer">
                                <span className="font-bold text-[16px]">Create new</span>
                                <span className="text-[13px] text-muted-foreground leading-snug">All responses will appear as a new item in Manage Jobs and Responses</span>
                            </Label>
                        </div>
                        <div className="flex items-start gap-4 opacity-70">
                            <RadioGroupItem value="previous" id="previous" className="mt-1" disabled />
                            <Label htmlFor="previous" className="flex flex-col gap-1 cursor-pointer">
                                <span className="font-bold text-[16px]">Use a previous one/posted job</span>
                                <span className="text-[13px] text-muted-foreground leading-snug">Responses will be clubbed with a previous invite/posted job</span>
                            </Label>
                        </div>
                    </RadioGroup>
                </div>

                {/* Section 2: Compose details */}
                <div className="bg-card rounded-lg border border-border shadow-sm p-8">
                    <h2 className="text-[20px] font-bold text-foreground mb-2">Compose details to be shared with candidates</h2>
                    <button className="text-primary text-[14px] font-medium hover:underline mb-8">Pre-fill details using a previous invite</button>

                    <div className="space-y-8">
                        <div className="grid grid-cols-4 gap-6">
                            <div className="col-span-3">
                                <Label className="text-[14px] font-bold text-foreground mb-2 block">Designation <span className="text-destructive">*</span></Label>
                                <Input
                                    placeholder="Short & specific designations get more candidate attention"
                                    className="h-[44px]"
                                    value={formData.designation}
                                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label className="text-[14px] font-bold text-foreground mb-2 block">Work mode <span className="text-destructive">*</span></Label>
                                <Select
                                    value={formData.workMode}
                                    onValueChange={(val) => setFormData({ ...formData, workMode: val })}
                                >
                                    <SelectTrigger className="h-[44px]">
                                        <SelectValue placeholder="Select work mode" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="office">In office</SelectItem>
                                        <SelectItem value="remote">Remote</SelectItem>
                                        <SelectItem value="hybrid">Hybrid</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label className="text-[14px] font-bold text-foreground mb-2 block">Key skills <span className="text-destructive">*</span></Label>
                            <Input
                                placeholder="Add skills"
                                className="h-[44px]"
                                value={formData.skills}
                                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                            />
                        </div>

                        <div className="grid grid-cols-4 gap-6 items-end">
                            <div className="col-span-1">
                                <Label className="text-[14px] font-bold text-foreground mb-2 block">Work experience (years) <span className="text-destructive">*</span></Label>
                                <Select value={formData.minExp} onValueChange={(val) => setFormData({ ...formData, minExp: val })}>
                                    <SelectTrigger className="h-[44px]">
                                        <SelectValue placeholder="Minimum" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[...Array(16)].map((_, i) => (
                                            <SelectItem key={i} value={i.toString()}>{i}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center justify-center h-[44px] text-muted-foreground">to</div>
                            <div className="col-span-1">
                                <Select value={formData.maxExp} onValueChange={(val) => setFormData({ ...formData, maxExp: val })}>
                                    <SelectTrigger className="h-[44px]">
                                        <SelectValue placeholder="Maximum" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[...Array(16)].map((_, i) => (
                                            <SelectItem key={i + 1} value={(i + 1).toString()}>{i + 1}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div>
                            <Label className="text-[14px] font-bold text-foreground mb-2 block">Job location (maximum 3) <span className="text-destructive">*</span></Label>
                            <Input
                                placeholder="Search and add locations"
                                className="h-[44px]"
                                value={formData.location}
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            />
                        </div>

                        <div className="space-y-4">
                            <Label className="text-[14px] font-bold text-foreground mb-0 block">Annual offered salary <span className="text-destructive">*</span></Label>
                            <div className="flex items-center gap-4">
                                <div className="flex h-[44px] w-[60px] items-center justify-center border border-input bg-muted/50 rounded-md font-bold">₹</div>
                                <div className="grid grid-cols-5 gap-4 flex-1 items-center">
                                    <Select value={formData.minSalary} onValueChange={(val) => setFormData({ ...formData, minSalary: val })}>
                                        <SelectTrigger className="h-[44px] col-span-2">
                                            <SelectValue placeholder="Minimum" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[...Array(51)].map((_, i) => (
                                                <SelectItem key={i} value={i.toString()}>{i} Lacs</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <div className="flex items-center justify-center text-muted-foreground">to</div>
                                    <Select value={formData.maxSalary} onValueChange={(val) => setFormData({ ...formData, maxSalary: val })}>
                                        <SelectTrigger className="h-[44px] col-span-2">
                                            <SelectValue placeholder="Maximum" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[...Array(51)].map((_, i) => (
                                                <SelectItem key={i + 1} value={(i + 1).toString()}>{i + 1} Lacs</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="hide-salary"
                                    checked={formData.hideSalary}
                                    onCheckedChange={(val) => setFormData({ ...formData, hideSalary: !!val })}
                                />
                                <Label htmlFor="hide-salary" className="text-[13px] text-muted-foreground flex items-center gap-1 cursor-pointer">
                                    Hide salary details from candidates (not recommended) <Info className="w-3.5 h-3.5" />
                                </Label>
                            </div>
                        </div>

                        <div>
                            <Label className="text-[14px] font-bold text-foreground mb-4 block">Job description <span className="text-destructive">*</span></Label>
                            <div className="border border-border rounded-lg overflow-hidden bg-background">
                                <div className="flex items-center gap-4 px-4 py-2 border-b border-border bg-muted/20">
                                    <div className="flex items-center gap-2 border-r border-border pr-4">
                                        <button className="p-1.5 hover:bg-muted rounded font-bold">B</button>
                                        <button className="p-1.5 hover:bg-muted rounded italic">I</button>
                                        <button className="p-1.5 hover:bg-muted rounded underline">U</button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button className="p-1.5 hover:bg-muted rounded">List</button>
                                        <button className="p-1.5 hover:bg-muted rounded">Numbered</button>
                                    </div>
                                    <div className="ml-auto">
                                        <input
                                            type="file"
                                            ref={jdFileInputRef}
                                            onChange={handleJDUpload}
                                            accept=".pdf,.doc,.docx,.txt"
                                            className="hidden"
                                        />
                                        <button
                                            onClick={() => jdFileInputRef.current?.click()}
                                            disabled={isParsingJD}
                                            className="text-primary text-[13px] font-bold hover:underline flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isParsingJD ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                            Upload JD
                                        </button>
                                    </div>
                                </div>
                                <Textarea
                                    className="p-4 min-h-[250px] border-none focus-visible:ring-0 resize-none font-medium text-[14px]"
                                    value={formData.jd}
                                    onChange={(e) => setFormData({ ...formData, jd: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section: Document Processing Actions */}
                <div className="bg-card rounded-lg border border-border shadow-sm p-8">
                    <h2 className="text-[18px] font-bold text-foreground mb-6">Document processing options</h2>
                    <div className="grid grid-cols-2 gap-6">
                        <div className="flex items-center gap-3">
                            <Checkbox
                                id="remove-pii"
                                checked={actions.removePii}
                                onCheckedChange={(val) => setActions({ ...actions, removePii: !!val })}
                            />
                            <Label htmlFor="remove-pii" className="text-[14px] font-medium cursor-pointer">Remove PII from Resume (Email, Phone)</Label>
                        </div>
                        <div className="flex items-center gap-3">
                            <Checkbox
                                id="remove-ctc"
                                checked={actions.removeCTC}
                                onCheckedChange={(val) => setActions({ ...actions, removeCTC: !!val })}
                            />
                            <Label htmlFor="remove-ctc" className="text-[14px] font-medium cursor-pointer">Remove CTC from JD content</Label>
                        </div>
                        <div className="flex items-center gap-3">
                            <Checkbox
                                id="watermark"
                                checked={actions.watermark}
                                onCheckedChange={(val) => setActions({ ...actions, watermark: !!val })}
                            />
                            <Label htmlFor="watermark" className="text-[14px] font-medium cursor-pointer">Add "Profile sourced by KM" watermark</Label>
                        </div>
                        <div className="flex items-center gap-3">
                            <Checkbox
                                id="both-formats"
                                checked={actions.attachBothFormats}
                                onCheckedChange={(val) => setActions({ ...actions, attachBothFormats: !!val })}
                            />
                            <Label htmlFor="both-formats" className="text-[14px] font-medium cursor-pointer">Attach both PDF and DOCX formats</Label>
                        </div>
                    </div>
                </div>

                {/* Section 3: Add team members */}
                <div className="bg-card rounded-lg border border-border shadow-sm p-8">
                    <h2 className="text-[18px] font-bold text-foreground mb-2">Add team members who can view and manage this invite's responses</h2>
                    <p className="text-[13px] text-muted-foreground mb-6">You and <span className="font-bold text-foreground">Vinod@kenmccoy.in</span> (super-user) are already included <button className="text-primary hover:underline">Select more users</button></p>

                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Checkbox id="email-notif" checked />
                            <Label htmlFor="email-notif" className="text-[14px] font-medium cursor-pointer flex items-center gap-2">
                                Get responses through email as well, on every new response <span className="text-[11px] px-1.5 py-0.5 bg-green-100 text-green-700 font-bold rounded">No extra cost</span>
                            </Label>
                        </div>
                        <p className="text-[12px] text-muted-foreground">Users who'll receive responses through email (max 5) <Info className="w-3 h-3 inline" /></p>

                        <div className="border border-border rounded-lg p-3 bg-background min-h-[100px] flex flex-wrap gap-2 items-start content-start focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                            {formData.teamEmails.map((email, index) => (
                                <Badge key={index} variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100 flex items-center gap-1.5 py-1 px-3 rounded-full animate-in zoom-in-95 duration-200">
                                    {email} <X className="w-3 h-3 cursor-pointer hover:text-blue-900 transition-colors" onClick={() => removeEmail(index)} />
                                </Badge>
                            ))}
                            <input
                                placeholder={formData.teamEmails.length === 0 ? "Search or select from list" : ""}
                                className="text-[14px] outline-none flex-1 min-w-[200px] bg-transparent py-1 h-[28px]"
                                value={emailInput}
                                onChange={(e) => setEmailInput(e.target.value)}
                                onKeyDown={handleEmailKeyDown}
                                onBlur={() => emailInput && addEmail(emailInput)}
                            />
                        </div>
                    </div>
                </div>

                {/* Section 4: Reach out */}
                <div className="bg-card rounded-lg border border-border shadow-sm p-8">
                    <h2 className="text-[18px] font-bold text-foreground mb-6">Candidates will be able to view your invite on their</h2>
                    <div className="flex items-center gap-12 text-muted-foreground">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
                                <Info className="w-5 h-5 text-orange-500" />
                            </div>
                            <span className="text-[14px] font-medium">App notification</span>
                        </div>
                        <span className="text-border">+</span>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                                <Mail className="w-5 h-5 text-blue-500" />
                            </div>
                            <span className="text-[14px] font-medium">Email</span>
                        </div>
                        <span className="text-border">+</span>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-pink-50 flex items-center justify-center">
                                <FileText className="w-5 h-5 text-pink-500" />
                            </div>
                            <span className="text-[14px] font-medium">Naukri inbox</span>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-10 border-t border-border mt-10">
                    <div className="flex flex-col">
                        <span className="text-[12px] text-muted-foreground">Reaching out to</span>
                        <span className="text-[18px] font-bold">1 candidate</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button
                            variant="outline"
                            className="px-10 h-[48px] font-bold border-primary text-primary hover:bg-primary/5"
                            onClick={() => toast.success('Preview feature coming soon')}
                        >
                            Preview
                        </Button>
                        <Button
                            className="px-10 h-[48px] font-bold bg-zinc-950 text-white hover:bg-zinc-900 min-w-[160px] border-none"
                            onClick={handleSend}
                            disabled={isSending}
                        >
                            {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send now'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}

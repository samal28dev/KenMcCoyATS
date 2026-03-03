'use client'

import { FileSpreadsheet, Download, Loader2, CalendarRange, Upload, FileUp, Info } from 'lucide-react'
import { useState, useRef } from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { apiFetch } from '@/lib/api'
import { DateInput } from '@/components/ui/date-picker'
import { toast } from 'sonner'

const REPORTS = [
    { key: 'clientDetails', label: 'Client Details Report', description: 'All client information with contacts, GSTIN, agreement dates' },
    { key: 'candidate', label: 'Candidate Report', description: 'Candidate name, company, designation, contact, status' },
    { key: 'positionClient', label: 'Position Client-wise Report', description: 'Client → position mapping with candidate counts' },
    { key: 'joiningOffer', label: 'Joining / Offer Stage Report', description: 'Candidates at offer or joined stage with joining details' },
    { key: 'generalClient', label: 'General Client Report', description: 'Client summary with total positions and CVs sourced' },
    { key: 'master', label: 'Master Report', description: 'Comprehensive report across all clients — Operations Head only', restricted: true },
]

export default function ReportsPage() {
    const [exporting, setExporting] = useState<string | null>(null)
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [importing, setImporting] = useState(false)
    const [customExporting, setCustomExporting] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const customFileRef = useRef<HTMLInputElement>(null)

    const handleExport = async (reportKey: string) => {
        setExporting(reportKey)
        try {
            const params = new URLSearchParams({ type: reportKey })
            if (reportKey === 'master') {
                if (dateFrom) params.set('from', dateFrom)
                if (dateTo) params.set('to', dateTo)
            }

            const res = await apiFetch(`/api/reports/export?${params}`)

            if (!res.ok) {
                const err = await res.json()
                toast.error(err.error || 'Export failed')
                return
            }

            // Download the Excel file
            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${reportKey}_report_${Date.now()}.xlsx`
            document.body.appendChild(a)
            a.click()
            a.remove()
            window.URL.revokeObjectURL(url)
            toast.success('Report downloaded successfully')
        } catch {
            toast.error('Failed to generate report')
        } finally {
            setExporting(null)
        }
    }

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const allowed = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel']
        if (!allowed.includes(file.type) && !file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
            toast.error('Please upload a CSV or XLSX file')
            return
        }

        setImporting(true)
        try {
            const formData = new FormData()
            formData.append('file', file)

            const res = await apiFetch('/api/import', { method: 'POST', body: formData })
            if (!res.ok) {
                const err = await res.json()
                toast.error(err.error || 'Import failed')
                return
            }

            const result = await res.json()
            toast.success(`Imported ${result.imported || 0} records successfully`)
        } catch {
            toast.error('Import failed')
        } finally {
            setImporting(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    return (
        <AppShell>
            <div className="min-h-screen">
                <div className="border-b border-border/50 bg-background">
                    <div className="px-6 py-6 max-w-7xl mx-auto flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
                            <p className="text-sm text-muted-foreground mt-1">Export data as Excel reports or import legacy data</p>
                        </div>
                        <div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                onChange={handleImport}
                                className="hidden"
                                id="import-file"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={importing}
                                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                {importing ? 'Importing...' : 'Mass Import'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
                    {/* Master report date filters */}
                    <div className="rounded-xl border border-border bg-card p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <CalendarRange className="h-4 w-4 text-muted-foreground" />
                            <h2 className="text-sm font-semibold">Date Range Filter</h2>
                            <span className="text-[10px] text-muted-foreground">(applies to Master Report)</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div>
                                <label className="text-xs text-muted-foreground">From</label>
                                <div className="mt-1 w-[180px]">
                                    <DateInput value={dateFrom} onChange={setDateFrom} placeholder="Start date" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">To</label>
                                <div className="mt-1 w-[180px]">
                                    <DateInput value={dateTo} onChange={setDateTo} placeholder="End date" />
                                </div>
                            </div>
                            {(dateFrom || dateTo) && (
                                <button onClick={() => { setDateFrom(''); setDateTo('') }}
                                    className="mt-5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground">
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Report cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {REPORTS.map((report) => (
                            <div key={report.key} className="rounded-xl border border-border bg-card p-5 flex flex-col">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                                        <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                                    </div>
                                    {report.restricted && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                                            Ops Head Only
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-sm font-semibold">{report.label}</h3>
                                <p className="text-xs text-muted-foreground mt-1 flex-1">{report.description}</p>
                                <button
                                    onClick={() => handleExport(report.key)}
                                    disabled={exporting === report.key}
                                    className="mt-4 inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors w-full"
                                >
                                    {exporting === report.key ? (
                                        <><Loader2 className="h-3 w-3 animate-spin" /> Generating...</>
                                    ) : (
                                        <><Download className="h-3 w-3" /> Download Excel</>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Custom Report */}
                    <div className="rounded-xl border border-border bg-card p-5">
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <h3 className="text-sm font-semibold flex items-center gap-2">
                                    <FileUp className="h-4 w-4 text-blue-500" />
                                    Customized Report
                                </h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Upload an Excel template with column headers — the system generates a report matching your format.
                                </p>
                            </div>
                        </div>

                        <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                            <div className="flex items-center gap-1.5 mb-2">
                                <Info className="h-3 w-3 text-muted-foreground" />
                                <span className="text-[10px] font-medium text-muted-foreground">SUPPORTED COLUMNS</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground leading-relaxed space-y-1">
                                <p><strong className="text-foreground">Candidate:</strong> Name, Email, Mobile, Designation, Current Company, Location, Experience, CTC, Notice Period, DOB, Age, Qualification, Skills, Status</p>
                                <p><strong className="text-foreground">Pipeline:</strong> Interview Status, Remarks, Feedback, Joining Date, Joining Location</p>
                                <p><strong className="text-foreground">Position:</strong> Position, Position Name</p>
                                <p><strong className="text-foreground">Client:</strong> Client Name, Company Name, GSTIN, City, State, Country, Location Type</p>
                                <p><strong className="text-foreground">User:</strong> Recruiter, Assigned To</p>
                            </div>
                        </div>

                        <input
                            ref={customFileRef}
                            type="file"
                            accept=".xlsx,.xls"
                            className="hidden"
                            onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                setCustomExporting(true)
                                try {
                                    const fd = new FormData()
                                    fd.append('file', file)
                                    const res = await apiFetch('/api/reports/custom', { method: 'POST', body: fd })
                                    if (!res.ok) {
                                        const err = await res.json()
                                        toast.error(err.error || 'Custom report failed')
                                        return
                                    }
                                    const unmapped = res.headers.get('X-Unmapped-Columns')
                                    if (unmapped && unmapped !== 'none') {
                                        toast.info(`Some columns could not be mapped: ${unmapped}`)
                                    }
                                    const blob = await res.blob()
                                    const url = window.URL.createObjectURL(blob)
                                    const a = document.createElement('a')
                                    a.href = url
                                    a.download = `custom_report_${Date.now()}.xlsx`
                                    document.body.appendChild(a)
                                    a.click()
                                    a.remove()
                                    window.URL.revokeObjectURL(url)
                                    toast.success('Custom report downloaded!')
                                } catch {
                                    toast.error('Failed to generate custom report')
                                } finally {
                                    setCustomExporting(false)
                                    if (customFileRef.current) customFileRef.current.value = ''
                                }
                            }}
                        />
                        <button
                            onClick={() => customFileRef.current?.click()}
                            disabled={customExporting}
                            className="mt-4 inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors w-full"
                        >
                            {customExporting ? (
                                <><Loader2 className="h-3 w-3 animate-spin" /> Generating...</>
                            ) : (
                                <><Upload className="h-3 w-3" /> Upload Template & Generate Report</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </AppShell>
    )
}

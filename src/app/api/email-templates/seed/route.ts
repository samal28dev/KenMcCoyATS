import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import dbConnect from '@/lib/db'
import EmailTemplate from '@/models/EmailTemplate'

const SEED_TEMPLATES = [
    {
        name: 'Interview Invitation',
        category: 'recruitment',
        type: 'interview_invitation',
        subject: 'Interview Invitation – {{position_title}} at {{client_company}}',
        content: `Dear {{candidate_name}},

Greetings from Ken McCoy Consulting!

We are pleased to inform you that your profile has been shortlisted for the position of {{position_title}} with our client, {{client_company}}.

We would like to schedule an interview at your earliest convenience. Please find the details below:

Position: {{position_title}}
Client: {{client_company}}
Location: {{location}}
Interview Date: {{interview_date}}
Interview Time: {{interview_time}}
Mode: {{interview_mode}}

Kindly confirm your availability by replying to this email.

If you have any questions, please do not hesitate to reach out.

Best regards,
{{sender_name}}
Ken McCoy Consulting`,
        variables: ['candidate_name', 'position_title', 'client_company', 'location', 'interview_date', 'interview_time', 'interview_mode', 'sender_name'],
        tags: ['interview', 'invitation', 'scheduling'],
    },
    {
        name: 'Candidate Rejection',
        category: 'recruitment',
        type: 'rejection',
        subject: 'Application Update – {{position_title}}',
        content: `Dear {{candidate_name}},

Thank you for your interest in the {{position_title}} position with {{client_company}} and for taking the time to go through the evaluation process.

After careful consideration, we regret to inform you that we will not be proceeding with your application at this time. This was a difficult decision, and it does not diminish the value of your experience and qualifications.

We will keep your profile in our database and reach out should a suitable opportunity arise in the future.

We wish you all the best in your career endeavours.

Warm regards,
{{sender_name}}
Ken McCoy Consulting`,
        variables: ['candidate_name', 'position_title', 'client_company', 'sender_name'],
        tags: ['rejection', 'update'],
    },
    {
        name: 'Offer Letter Introduction',
        category: 'recruitment',
        type: 'offer',
        subject: 'Offer of Employment – {{position_title}} at {{client_company}}',
        content: `Dear {{candidate_name}},

Congratulations!

We are delighted to inform you that {{client_company}} has extended an offer of employment for the position of {{position_title}}.

Please find the offer letter attached for your review. Kindly go through the terms and conditions and revert with your acceptance or any queries within {{response_deadline}}.

Key Details:
Position: {{position_title}}
Location: {{location}}
Expected Joining Date: {{joining_date}}

We look forward to your positive response.

Best regards,
{{sender_name}}
Ken McCoy Consulting`,
        variables: ['candidate_name', 'position_title', 'client_company', 'location', 'joining_date', 'response_deadline', 'sender_name'],
        tags: ['offer', 'employment'],
    },
    {
        name: 'Follow-up with Candidate',
        category: 'recruitment',
        type: 'follow_up',
        subject: 'Follow-up – {{position_title}} Application',
        content: `Dear {{candidate_name}},

I hope this email finds you well.

I wanted to follow up regarding the {{position_title}} position with {{client_company}}. We are keen to move forward and would appreciate an update from your end.

Could you please confirm the following at your earliest convenience:
- Your continued interest in the role
- Your availability for the next round
- Any questions or concerns you may have

Looking forward to hearing from you.

Best regards,
{{sender_name}}
Ken McCoy Consulting`,
        variables: ['candidate_name', 'position_title', 'client_company', 'sender_name'],
        tags: ['follow-up', 'candidate'],
    },
    {
        name: 'Candidate Introduction to Client',
        category: 'client',
        type: 'candidate_introduction',
        subject: 'Candidate Profile – {{candidate_name}} for {{position_title}}',
        content: `Dear {{client_contact_name}},

Greetings from Ken McCoy Consulting!

Please find attached the profile of {{candidate_name}} for the {{position_title}} position.

Candidate Summary:
Name: {{candidate_name}}
Current Organization: {{current_company}}
Total Experience: {{experience}} years
Current CTC: {{current_ctc}}
Notice Period: {{notice_period}} days
Location: {{candidate_location}}

We believe this candidate is a strong fit for the role. Kindly review the attached resume and share your feedback at the earliest.

Please note: Profile sourced by Ken McCoy Consulting.

Best regards,
{{sender_name}}
Ken McCoy Consulting`,
        variables: ['client_contact_name', 'candidate_name', 'position_title', 'current_company', 'experience', 'current_ctc', 'notice_period', 'candidate_location', 'sender_name'],
        tags: ['introduction', 'client', 'profile'],
    },
    {
        name: 'Client Status Update',
        category: 'client',
        type: 'client_update',
        subject: 'Recruitment Update – {{position_title}}',
        content: `Dear {{client_contact_name}},

Greetings from Ken McCoy Consulting!

Please find below the status update for the {{position_title}} position:

Total Profiles Sourced: {{profiles_sourced}}
Profiles Shortlisted: {{profiles_shortlisted}}
Interviews Scheduled: {{interviews_scheduled}}
Offers Extended: {{offers_extended}}

{{additional_notes}}

We are actively working on this mandate and will continue to share suitable profiles. Please feel free to reach out if you need any clarification or wish to discuss the progress.

Best regards,
{{sender_name}}
Ken McCoy Consulting`,
        variables: ['client_contact_name', 'position_title', 'profiles_sourced', 'profiles_shortlisted', 'interviews_scheduled', 'offers_extended', 'additional_notes', 'sender_name'],
        tags: ['update', 'client', 'status'],
    },
]

// POST /api/email-templates/seed — seed default templates
export async function POST() {
    try {
        const user = await verifyAuth()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // Only admins / ops heads can seed
        if (!['super_admin', 'admin', 'operations_head'].includes(user.role)) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
        }

        await dbConnect()

        // Check which templates already exist (by type) to avoid duplicates
        const existing = await EmailTemplate.find({ isActive: true }).select('type name').lean()
        const existingTypes = new Set(existing.map((t: any) => `${t.type}__${t.name}`))

        const toInsert = SEED_TEMPLATES.filter(t => !existingTypes.has(`${t.type}__${t.name}`))

        if (toInsert.length === 0) {
            return NextResponse.json({
                message: 'All default templates already exist',
                seeded: 0,
                total: existing.length,
            })
        }

        const inserted = await EmailTemplate.insertMany(toInsert)

        return NextResponse.json({
            message: `Seeded ${inserted.length} email template(s)`,
            seeded: inserted.length,
            skipped: SEED_TEMPLATES.length - inserted.length,
            total: existing.length + inserted.length,
            templates: inserted.map((t: any) => ({ name: t.name, type: t.type })),
        }, { status: 201 })
    } catch (error) {
        console.error('Email template seed error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

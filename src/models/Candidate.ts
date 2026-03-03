import mongoose from 'mongoose'

// ── Enums for frontend dropdowns ──
export const QUALIFICATION_OPTIONS = [
    'B.Tech', 'M.Tech', 'B.E.', 'M.E.', 'BCA', 'MCA',
    'B.Sc', 'M.Sc', 'B.Com', 'M.Com', 'BBA', 'MBA',
    'B.A.', 'M.A.', 'PhD', 'Diploma', '12th', '10th',
    'ITI', 'Other'
] as const

export const COUNTRY_CODE_OPTIONS = [
    { code: '+91', label: 'India (+91)' },
    { code: '+1', label: 'USA/Canada (+1)' },
    { code: '+44', label: 'UK (+44)' },
    { code: '+971', label: 'UAE (+971)' },
    { code: '+966', label: 'Saudi Arabia (+966)' },
    { code: '+65', label: 'Singapore (+65)' },
    { code: '+61', label: 'Australia (+61)' },
    { code: '+49', label: 'Germany (+49)' },
    { code: '+33', label: 'France (+33)' },
    { code: '+81', label: 'Japan (+81)' },
    { code: '+86', label: 'China (+86)' },
    { code: '+974', label: 'Qatar (+974)' },
    { code: '+968', label: 'Oman (+968)' },
    { code: '+973', label: 'Bahrain (+973)' },
    { code: '+60', label: 'Malaysia (+60)' },
] as const

const CandidateSchema = new mongoose.Schema({
    // Basic info
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    countryCode: {
        type: String,
        default: '+91',
        enum: COUNTRY_CODE_OPTIONS.map(c => c.code),
    },
    alternativeMobile: { type: String },
    alternativeCountryCode: {
        type: String,
        enum: [...COUNTRY_CODE_OPTIONS.map(c => c.code), null, ''],
    },
    location: { type: String },

    // Professional info
    currentCompany: { type: String },
    designation: { type: String },
    experience: { type: String },
    qualifications: [{
        type: String,
        enum: QUALIFICATION_OPTIONS,
    }],
    skills: [{ type: String }],

    // Compensation
    ctc: { type: Number },
    noticePeriod: { type: Number },

    // Personal
    dob: { type: Date },
    age: { type: Number },

    // Social links
    linkedin: { type: String },
    github: { type: String },
    portfolio: { type: String },

    // Status & linkage
    status: {
        type: String,
        enum: [
            'new', 'screening', 'shortlisted', 'interview',
            'offered', 'joined', 'rejected', 'on_hold'
        ],
        default: 'new'
    },
    positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position' },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },

    // Assignment
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Documents
    resumeFile: { type: String }, // Path or URL instead of Convex Storage ID
    resumeFilename: { type: String },
    resumeDocVersion: { type: String },
    resumePdfVersion: { type: String },

    // Parsing & Duplicate checking
    resumeHash: { type: String },
    resumeWordCount: { type: Number },
    lastParsedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastParsedAt: { type: Date },

    // Candidate Locking
    isLocked: { type: Boolean, default: false },
    lockedByPosition: { type: mongoose.Schema.Types.ObjectId, ref: 'Position' },
    lockedAt: { type: Date },

    // Metadata
    appliedDate: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Evaluation (backward compatibility)
    evaluation: {
        overall: { type: Number },
        technical: { type: Number },
        cultural: { type: Number },
        communication: { type: Number }
    }
}, {
    timestamps: true // createdAt and updatedAt
});

// Auto-calculate age from DOB on save
CandidateSchema.pre('save', function (this: any) {
    if (this.dob) {
        const today = new Date()
        const birthDate = new Date(this.dob)
        let age = today.getFullYear() - birthDate.getFullYear()
        const monthDiff = today.getMonth() - birthDate.getMonth()
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--
        }
        this.age = age
    }
})

// Indexes for text search and efficient filtering
CandidateSchema.index({ name: 'text', email: 'text' });
CandidateSchema.index({ phone: 1 });
CandidateSchema.index({ email: 1 });
CandidateSchema.index({ status: 1 });
CandidateSchema.index({ positionId: 1 });
CandidateSchema.index({ clientId: 1 });
CandidateSchema.index({ assignedTo: 1 });
CandidateSchema.index({ resumeHash: 1 });

export default mongoose.models.Candidate || mongoose.model('Candidate', CandidateSchema);

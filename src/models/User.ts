import mongoose from 'mongoose'

const UserSchema = new mongoose.Schema({
    // CRM Base fields
    username: { type: String, unique: true, sparse: true, trim: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fullName: { type: String, trim: true },
    phone: { type: String, trim: true },
    department: { type: String, trim: true },

    // Mixed role system (CRM + ATS)
    role: {
        type: String,
        enum: [
            // CRM Roles
            'superadmin', 'admin', 'manager', 'staff',
            // ATS Roles
            'super_admin', 'operations_head', 'team_lead', 'recruiter'
        ],
        default: 'staff'
    },

    // ATS Specific Fields
    name: { type: String, trim: true }, // Equivalent to fullName for ATS
    avatar: { type: String },
    atsPermissions: [{ type: String }],

    // CRM Specific Fields
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    teamMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    permissions: {
        leads: {
            view: { type: String, enum: ['all', 'department', 'team', 'assigned', 'none'], default: 'assigned' },
            create: { type: Boolean, default: true },
            edit: { type: String, enum: ['all', 'department', 'team', 'assigned', 'none'], default: 'assigned' },
            delete: { type: String, enum: ['all', 'department', 'team', 'assigned', 'none'], default: 'none' },
            export: { type: Boolean, default: false },
            assign: { type: Boolean, default: false }
        },
        pipelines: {
            view: { type: Boolean, default: true },
            edit: { type: Boolean, default: false }
        },
        tasks: {
            view: { type: String, enum: ['all', 'department', 'team', 'assigned', 'none'], default: 'assigned' },
            create: { type: Boolean, default: true },
            edit: { type: String, enum: ['all', 'department', 'team', 'assigned', 'none'], default: 'assigned' },
            delete: { type: String, enum: ['all', 'department', 'team', 'assigned', 'none'], default: 'none' }
        },
        users: {
            view: { type: String, enum: ['all', 'department', 'team', 'none'], default: 'none' },
            create: { type: String, enum: ['admin', 'manager', 'staff', 'none'], default: 'none' },
            edit: { type: String, enum: ['all', 'department', 'team', 'none'], default: 'none' },
            delete: { type: String, enum: ['all', 'department', 'team', 'none'], default: 'none' }
        },
        analytics: {
            view: { type: String, enum: ['all', 'department', 'team', 'own', 'none'], default: 'own' }
        },
        settings: {
            view: { type: Boolean, default: false },
            edit: { type: Boolean, default: false }
        },
        communications: {
            send: { type: Boolean, default: true },
            view: { type: String, enum: ['all', 'department', 'team', 'own', 'none'], default: 'own' }
        }
    },

    isActive: { type: Boolean, default: true },
    apiKey: { type: String, unique: true, sparse: true },
    emailConfig: {
        outlookEmail: { type: String, trim: true },
        outlookPassword: { type: String },
        isConfigured: { type: Boolean, default: false },
        lastVerified: { type: Date }
    },
    notificationPreferences: {
        statusChanges: { type: Boolean, default: true },
        comments: { type: Boolean, default: true },
        assignments: { type: Boolean, default: true },
        agreements: { type: Boolean, default: true },
    },
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date },
    updatedAt: { type: Date, default: Date.now }
});

// Middleware to sync fullName and name
UserSchema.pre('save', function (this: any) {
    if (this.isModified('fullName') && !this.isModified('name')) {
        this.name = this.fullName;
    }
    if (this.isModified('name') && !this.isModified('fullName')) {
        this.fullName = this.name;
    }
    this.updatedAt = new Date();
});

export default mongoose.models.User || mongoose.model('User', UserSchema);

import mongoose from 'mongoose'

// Indian States & Union Territories
const INDIAN_STATES_UTS = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
    'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    // Union Territories
    'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
    'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
]

const COUNTRIES = [
    'India', 'United States', 'United Kingdom', 'Canada', 'Australia',
    'Germany', 'France', 'Singapore', 'United Arab Emirates', 'Japan',
    'China', 'South Korea', 'Netherlands', 'Switzerland', 'Sweden',
    'Ireland', 'Israel', 'New Zealand', 'South Africa', 'Brazil',
    'Mexico', 'Italy', 'Spain', 'Poland', 'Saudi Arabia', 'Qatar',
    'Malaysia', 'Indonesia', 'Philippines', 'Thailand', 'Vietnam',
    'Bangladesh', 'Sri Lanka', 'Nepal', 'Other',
]

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ClientSchema = new mongoose.Schema({
    companyName: { type: String, required: true },
    address: {
        line1: { type: String, required: true },
        line2: { type: String },
        line3: { type: String },
        city: { type: String, required: true },
        state: {
            type: String,
            required: true,
            enum: { values: INDIAN_STATES_UTS, message: '{VALUE} is not a valid Indian State/UT' }
        },
        pin: { type: String, required: true, match: [/^\d{6,8}$/, 'PIN must be 6-8 digits'] },
        country: {
            type: String,
            required: true,
            default: 'India',
            enum: { values: COUNTRIES, message: '{VALUE} is not a supported country' }
        }
    },
    gstin: { type: String, required: true },
    locationType: { type: String, enum: ['office', 'plant'], default: 'office' },
    contacts: [{
        name: { type: String, required: true },
        designation: { type: String },
        email: {
            type: String,
            validate: {
                validator: function (v: string) {
                    return !v || emailRegex.test(v)
                },
                message: (props: { value: string }) => `${props.value} is not a valid email address`
            }
        },
        mobile: { type: String }
    }],
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    agreementDate: { type: Date },
    agreementValidTill: { type: Date },
    remarks: { type: String },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, {
    timestamps: true // Adds createdAt and updatedAt automatically
});

// Indexes for searching and filtering
ClientSchema.index({ companyName: 'text' });
ClientSchema.index({ status: 1 });
ClientSchema.index({ assignedTo: 1 });

export default mongoose.models.Client || mongoose.model('Client', ClientSchema);
export { INDIAN_STATES_UTS, COUNTRIES };

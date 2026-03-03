import mongoose from 'mongoose'

const BillingSchema = new mongoose.Schema({
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position' },
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' },

    invoiceNumber: { type: String, unique: true, sparse: true },
    description: { type: String },

    amount: { type: Number, required: true, default: 0 },
    currency: { type: String, default: 'INR' },

    status: {
        type: String,
        enum: ['draft', 'invoiced', 'paid', 'overdue', 'cancelled'],
        default: 'draft',
    },

    invoiceDate: { type: Date },
    dueDate: { type: Date },
    paidDate: { type: Date },

    remarks: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, {
    timestamps: true,
})

BillingSchema.index({ clientId: 1 })
BillingSchema.index({ positionId: 1 })
BillingSchema.index({ status: 1 })
BillingSchema.index({ invoiceDate: 1 })

export default mongoose.models.Billing || mongoose.model('Billing', BillingSchema)

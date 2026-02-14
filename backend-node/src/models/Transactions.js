import mongoose from 'mongoose'
const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    amount: Number,
    category: String,
    merchant: String,
    type: {
        type: String,
        enum: ['credit', 'debit']
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    isSuspicious: {
        type: Boolean,
        default: false
    }
})
export default mongoose.model('Transaction', transactionSchema)
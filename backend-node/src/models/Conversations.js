import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    title: {
        type: String,
        default: "New Chat",
    },
    messages: [{
        role: {
            type: String,
            enum: ['user', 'assistant'],
            required: true,
        },
        content: {
            type: String,
            required: true,
        },
        timestamp: {
            type: Date,
            default: Date.now,
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    }
})


//BEFORE UPDATE
// conversationSchema.pre('save', function(next) {
//     this.updatedAt = Date.now()
//     next();
// })

//AFTER UPDATE - simplified with no next() 
conversationSchema.pre('save', function() {
    this.updatedAt = Date.now()
    
})

export default mongoose.model("Conversation", conversationSchema)
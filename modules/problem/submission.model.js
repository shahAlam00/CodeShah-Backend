import mongoose from "mongoose";

const SubmissionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    problemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Problem', required: true },
    code: { type: String, required: true },
    language: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['Accepted', 'Wrong Answer', 'Compilation Error', 'Runtime Error'], 
        required: true 
    },
    runtime: { type: String, default: 'N/A' },
    memory: { type: String, default: 'N/A' },
    errorDetails: { type: String, default: '' }
}, { timestamps: true }); // Isme createdAt aur updatedAt automatic mil jayega (date & time ke liye)

const Submission = mongoose.model("Submission", SubmissionSchema);
export default Submission;
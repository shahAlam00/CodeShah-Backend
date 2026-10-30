import mongoose from "mongoose";

const discussionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    title: {
        type: String,
        required: true
    },
    problemId: { // <--- Naya field add kiya (agar ye problem ke andar ki discussion hai)
        type: mongoose.Schema.Types.ObjectId,
        ref: "Problem",
        default: null
    },
    category: {
        type: String,
        required: true,
        default: "General"
    },
    content: {
        type: String,
        required: true
    },
    tags: [String],
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    repliesCount: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

export default mongoose.model("Discussion", discussionSchema);
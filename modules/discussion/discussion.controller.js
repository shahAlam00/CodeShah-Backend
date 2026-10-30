import Discussion from "./discussion.model.js";

export const createDiscussion = async (req, res) => {
    try {
        const { title, category, content, tags, problemId } = req.body;
        const userId = req.userId;

        if (!title || !content || !category) {
            return res.status(400).json({ message: "Title, category and content are required." });
        } 

        let formattedTags = tags;
        if (typeof tags === 'string') {
            formattedTags = tags.split(",").map(t => t.trim()).filter(Boolean);
        }

        const newDiscussion = await Discussion.create({
            user: userId,
            problemId: problemId || null, // Agar problem page se aayi hai toh problemId save hogi
            title,
            category,
            content,
            tags: formattedTags
        });

        const populatedDiscussion = await Discussion.findById(newDiscussion._id).populate("user", "fullName username avatar");

        return res.status(201).json({
            success: true,
            message: "Discussion created successfully",
            discussion: populatedDiscussion
        });

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const getDiscussionById = async (req, res) => {
    try {
        const discussion = await Discussion.findById(req.params.id).populate("user", "fullName username avatar");
        if (!discussion) return res.status(404).json({ message: "Discussion not found" });
        return res.status(200).json({ success: true, discussion });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Sabhi discussions fetch karne ke liye jisme author ka avatar aur naam milega
export const getAllDiscussions = async (req, res) => {
    try {
        const discussions = await Discussion.find()
            .populate("user", "fullName username avatar")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            discussions
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Problem Discussion

// Specific Problem ki discussions fetch karne ke liye
export const getDiscussionsByProblem = async (req, res) => {
    try {
        const { problemId } = req.params;
        const discussions = await Discussion.find({ problemId })
            .populate("user", "fullName username avatar")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            discussions
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
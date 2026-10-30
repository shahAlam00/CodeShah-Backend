import mongoose from "mongoose";

const ExampleSchema = new mongoose.Schema({
    input: { type: String, required: true },
    output: { type: String, required: true },
    explanation: { type: String, default: "" },
}, { _id: false });

const TestCaseSchema = new mongoose.Schema({
    input: { type: String, required: true },
    expectedOutput: { type: String, required: true },
    isSample: { type: Boolean, default: false },
    weight: { type: Number, default: 10 },
    explanation: { type: String, default: "" },
});

const StarterCodeSchema = new mongoose.Schema({
    javascript: { type: String, default: "" },
    typescript: { type: String, default: "" },
    python: { type: String, default: "" },
    java: { type: String, default: "" },
    cpp: { type: String, default: "" },
}, { _id: false });

const SolutionSchema = new mongoose.Schema({
    language: { type: String, enum: ["javascript", "typescript", "python", "java", "cpp", "go"], required: true },
    code: { type: String, required: true },
    explanation: { type: String, default: "" },
    timeComplexity: { type: String, default: "" },
    spaceComplexity: { type: String, default: "" },
}, { _id: false });

const EditorialDataSchema = new mongoose.Schema({
    title: { type: String, default: "" },
    overview: { type: String, default: "" },
    approach: { type: String, default: "" },
    keyInvariant: { type: String, default: "" },
    timeComplexity: { type: String, default: "O(N)" },
    spaceComplexity: { type: String, default: "O(1)" },
}, { _id: false });

const ProblemSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
        difficulty: { type: String, enum: ["Easy", "Medium", "Hard"], required: true },
        status: { type: String, enum: ["Draft", "Review", "Published", "Archived"], default: "Draft" },
        category: { type: String, default: "Algorithms" },
        topics: [{ type: String }],
        companies: [{ type: String }],
        description: { type: String, required: true },
        constraints: [{ type: String }],
        examples: [ExampleSchema],
        hints: [{ type: String }],
        followUp: { type: String, default: "" },
        editorial: { type: String, default: "" },
        editorialData: { type: EditorialDataSchema, default: () => ({}) },
        testCases: [TestCaseSchema],
        starterCode: { type: StarterCodeSchema, default: () => ({}) },
        solutions: [SolutionSchema],

        // Stats
        totalSubmissions: { type: Number, default: 0 },
        acceptedSubmissions: { type: Number, default: 0 },
        acceptanceRate: { type: Number, default: 0 },
        likes: { type: Number, default: 0 },
        dislikes: { type: Number, default: 0 },
        author: { type: String, default: "Admin" },
    },
    { timestamps: true }
);

const Problem = mongoose.model("Problem", ProblemSchema);
export default Problem;

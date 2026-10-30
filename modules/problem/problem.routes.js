import express from "express";
import {
    createProblem,
    getAllProblems,
    getProblemBySlug,
    getProblemById,
    updateProblem,
    deleteProblem,
    runCode,
    submitCode,
    getSubmissions,
} from "./problem.controller.js";
import { userAuth, optionalAuth } from "../../middleware/userAuth.js";

const problemRouter = express.Router();

// ── Public routes ─────────────────────────────────────────────────────────────
// Get all problems (list view, excludes heavy fields)
// optionalAuth lets us attach per-user isSolved flags without blocking guests
problemRouter.get("/all", optionalAuth, getAllProblems);

// Get single problem by MongoDB _id (admin edit page)
problemRouter.get("/id/:id", getProblemById);

// ── Code execution (requires login) ──────────────────────────────────────────
// Run code against sample test cases
problemRouter.post("/:slug/run", userAuth, runCode);

// Submit code against all test cases
problemRouter.post("/:slug/submit", userAuth, submitCode);

// Get user's submissions for a problem — must be BEFORE /:slug GET
problemRouter.get("/:slug/submissions", userAuth, getSubmissions);

// Get single problem by slug (full detail for code editor) — keep LAST among GETs
problemRouter.get("/:slug", getProblemBySlug);

// ── Admin CRUD (requires login) ───────────────────────────────────────────────
// Create new problem
problemRouter.post("/create", userAuth, createProblem);

// Update problem
problemRouter.put("/:id", userAuth, updateProblem);

// Delete problem
problemRouter.delete("/:id", userAuth, deleteProblem);


export default problemRouter;

import axios from "axios";
import Problem from "./problem.model.js";
import User from "../users/user.model.js";
import Submission from "./submission.model.js";
import { getWrappedCode } from "./codeWrapper.js";

// ─── Language ID map (Judge0 CE) ──────────────────────────────────────────────
// https://ce.judge0.com/languages/
const LANGUAGE_IDS = {
    javascript: 93,  // Node.js 18.15.0
    typescript: 94,  // TypeScript 5.0.3
    python: 71,  // Python 3.11.2
    java: 62,  // Java (OpenJDK 13.0.1)
    cpp: 54,  // C++ (GCC 9.2.0)
    c: 50,  // C (GCC 9.2.0)
};

const JUDGE0_BASE = "https://judge0-ce.p.rapidapi.com";
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || "";
const RAPIDAPI_HOST = "judge0-ce.p.rapidapi.com";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Sleep ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Build judge0 request headers.
 * Throws a clear error early if the key looks like a placeholder.
 */
function buildHeaders() {
    if (!RAPIDAPI_KEY || RAPIDAPI_KEY === "your_rapidapi_key_here") {
        const err = new Error(
            "JUDGE0_NOT_CONFIGURED: RAPIDAPI_KEY is not set. " +
            "Add your key to CodeBackend/.env — get a free key at " +
            "https://rapidapi.com/judge0-official/api/judge0-ce"
        );
        err.isConfigError = true;
        throw err;
    }
    return {
        "x-rapidapi-key": RAPIDAPI_KEY,
        "x-rapidapi-host": RAPIDAPI_HOST,
        "Content-Type": "application/json",
    };
}

/**
 * Classify an axios error from Judge0 into a human-readable status string.
 * Returns null if it is not a recognisable provider error (i.e. caller should re-throw).
 */
function classifyProviderError(err) {
    if (!err.response) return null;          // network error, not a provider response

    const status = err.response.status;
    const body = err.response.data;

    if (status === 429) {
        return {
            providerError: "RATE_LIMITED",
            message:
                "Judge0 rate limit reached (HTTP 429). " +
                "The free RapidAPI tier allows 50 requests/day. " +
                "Wait a few minutes and try again, or upgrade your plan at " +
                "https://rapidapi.com/judge0-official/api/judge0-ce",
        };
    }

    if (status === 403) {
        return {
            providerError: "FORBIDDEN",
            message:
                "Judge0 returned HTTP 403. Your RAPIDAPI_KEY is invalid or the " +
                "Judge0 CE API is not subscribed on your account. " +
                "Check https://rapidapi.com/judge0-official/api/judge0-ce",
        };
    }

    if (status === 401) {
        return {
            providerError: "UNAUTHORIZED",
            message: "Judge0 returned HTTP 401 — API key missing or malformed.",
        };
    }

    return null; // unknown — let the caller handle
}

/**
 * Submit one test case to Judge0, poll for result.
 * Runs SEQUENTIALLY (one at a time) to respect rate limits.
 *
 * Returns the raw Judge0 result object.
 * Throws a classified error on 429 / 403 / timeout / network failure.
 */
async function runOnJudge0(sourceCode, languageId, stdin = "") {
    const headers = buildHeaders();

    // ── 1. Create submission ──────────────────────────────────────────────────
    let createRes;
    try {
        createRes = await axios.post(
            `${JUDGE0_BASE}/submissions?base64_encoded=false&wait=false`,
            { source_code: sourceCode, language_id: languageId, stdin },
            { headers, timeout: 15_000 }
        );
    } catch (err) {
        const classified = classifyProviderError(err);
        if (classified) {
            const e = new Error(classified.message);
            e.providerError = classified.providerError;
            throw e;
        }
        throw new Error(`Judge0 submission failed: ${err.message}`);
    }

    const token = createRes.data?.token;
    if (!token) throw new Error("Judge0 did not return a submission token.");

    // ── 2. Poll for result (max 12 s, 500 ms intervals) ──────────────────────
    for (let i = 0; i < 24; i++) {
        await sleep(500);

        let pollRes;
        try {
            pollRes = await axios.get(
                `${JUDGE0_BASE}/submissions/${token}?base64_encoded=false`,
                { headers, timeout: 10_000 }
            );
        } catch (err) {
            const classified = classifyProviderError(err);
            if (classified) {
                const e = new Error(classified.message);
                e.providerError = classified.providerError;
                throw e;
            }
            throw new Error(`Judge0 poll failed: ${err.message}`);
        }

        const data = pollRes.data;
        const sid = data.status?.id;
        // status ids: 1 = In Queue, 2 = Processing, ≥3 = finished
        if (sid >= 3) return data;
    }

    throw new Error("Judge0 timed out after 12 s — the judge may be under load, try again.");
}

/**
 * Map Judge0 status id → human label.
 * id 3 = "Accepted" by Judge0 (i.e. ran without error; we still check stdout).
 */
function judge0StatusLabel(data) {
    const id = data.status?.id;
    const map = {
        3: "Accepted",        // ran successfully (stdout checked separately)
        4: "Wrong Answer",
        5: "Time Limit Exceeded",
        6: "Compilation Error",
        7: "Runtime Error (SIGSEGV)",
        8: "Runtime Error (SIGXFSZ)",
        9: "Runtime Error (SIGFPE)",
        10: "Runtime Error (SIGABRT)",
        11: "Runtime Error (NZEC)",
        12: "Runtime Error (Other)",
        13: "Internal Error",
        14: "Exec Format Error",
    };
    return map[id] || data.status?.description || "Unknown Error";
}

/**
 * Run test cases SEQUENTIALLY with a gap between each to stay inside
 * Judge0 free tier rate limits (~1 req/s sustained).
 *
 * @param {string}   sourceCode
 * @param {number}   languageId
 * @param {Array}    cases        - array of { input, expectedOutput, isSample }
 * @param {number}   [gapMs=1100] - delay between each test case submission
 * @param {boolean}  [hideNonSample=false] - mask input/expected for hidden cases
 */
async function runCasesSequentially(
    sourceCode,
    languageId,
    cases,
    gapMs = 1100,
    hideNonSample = false
) {
    const results = [];

    // Helper to normalize strings for comparison (removes spaces, newlines difference)
    const normalize = (str) => String(str || "").replace(/\s+/g, "").trim();

    for (let idx = 0; idx < cases.length; idx++) {
        const tc = cases[idx];

        // gap between submissions (skip before the very first one)
        if (idx > 0) await sleep(gapMs);

        let result;
        try {
            // Wrap user code with driver code for this test case
            const wrappedCode = getWrappedCode(languageId, sourceCode, tc.input);
            const j0 = await runOnJudge0(wrappedCode, languageId, tc.input);

            const j0Status = judge0StatusLabel(j0);
            const stdout = (j0.stdout || "").trim();
            const stderr = (j0.stderr || "").trim();
            const compErr = (j0.compile_output || "").trim();
            const expected = (tc.expectedOutput || "").trim();

            // ── What to show as "Your Output" ──────────────────────────────────
            let displayOutput;
            if (compErr) displayOutput = `[Compilation Error]\n${compErr}`;
            else if (stderr) displayOutput = `[stderr]\n${stderr}\n\n[stdout]\n${stdout}`;
            else displayOutput = stdout;

            // Judge0 id=3 means it ran without crashing.
            // "Passed" = ran cleanly AND normalized stdout matches normalized expected.
            const ranClean = j0.status?.id === 3;
            const passed = ranClean && normalize(stdout) === normalize(expected);

            // For hidden test cases mask the details
            const isHidden = hideNonSample && !tc.isSample;

            result = {
                id: idx + 1,
                input: isHidden ? "[hidden]" : tc.input,
                expected: isHidden ? "[hidden]" : tc.expectedOutput,
                actual: isHidden ? "[hidden]" : displayOutput,
                passed,
                // If it ran clean but stdout ≠ expected → Wrong Answer
                status: ranClean && !passed ? "Wrong Answer" : j0Status,
                time: j0.time ? `${j0.time} s` : null,
                memory: j0.memory ? `${j0.memory} KB` : null,
            };
        } catch (err) {
            const isProviderErr = err.providerError || err.isConfigError;
            const statusLabel =
                err.providerError === "RATE_LIMITED" ? "Rate Limited (429)" :
                    err.providerError === "FORBIDDEN" ? "API Key Error (403)" :
                        err.providerError === "UNAUTHORIZED" ? "API Key Error (401)" :
                            err.isConfigError ? "Not Configured" :
                                "Runtime Error";

            result = {
                id: idx + 1,
                input: tc.input,
                expected: tc.expectedOutput,
                actual: err.message,
                passed: false,
                status: statusLabel,
                providerError: err.providerError || (err.isConfigError ? "CONFIG" : null),
            };

            results.push(result);
            if (isProviderErr) break;
            continue; // fixed a small double push bug if error occurs
        }

        results.push(result);
    }

    return results;
}

// ─────────────────────────────────────────────────────────────────────────────
//  CRUD CONTROLLERS  (unchanged API contract)
// ─────────────────────────────────────────────────────────────────────────────

export const createProblem = async (req, res) => {
    try {
        const {
            title, slug, difficulty, status, category,
            topics, companies, description, constraints,
            examples, hints, followUp, editorial, editorialData,
            testCases, starterCode, solutions,
        } = req.body;

        if (!title || !slug || !difficulty || !description)
            return res.status(400).json({ message: "title, slug, difficulty and description are required." });

        const exists = await Problem.findOne({ slug });
        if (exists)
            return res.status(409).json({ message: `A problem with slug "${slug}" already exists.` });

        const problem = await Problem.create({
            title, slug, difficulty,
            status: status || "Draft",
            category: category || "Algorithms",
            topics: topics || [],
            companies: companies || [],
            description,
            constraints: constraints || [],
            examples: examples || [],
            hints: hints || [],
            followUp: followUp || "",
            editorial: editorial || "",
            editorialData: editorialData || {},
            testCases: testCases || [],
            starterCode: starterCode || {},
            solutions: solutions || [],
            author: "Admin",
        });

        return res.status(201).json({ success: true, problem });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const getAllProblems = async (req, res) => {
    try {
        const { status, difficulty, category, search, page = 1, limit = 50 } = req.query;
        const filter = {};
        if (status) filter.status = status;
        if (difficulty) filter.difficulty = difficulty;
        if (category) filter.category = category;
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: "i" } },
                { slug: { $regex: search, $options: "i" } },
                { topics: { $elemMatch: { $regex: search, $options: "i" } } },
            ];
        }
        const skip = (Number(page) - 1) * Number(limit);
        const total = await Problem.countDocuments(filter);
        const problems = await Problem
            .find(filter)
            .select("-testCases -solutions -starterCode -editorial")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        // Attach isSolved flag for logged-in user
        let solvedSet = new Set();
        if (req.userId) {
            const user = await User.findById(req.userId).select("solvedProblems");
            if (user) solvedSet = new Set(user.solvedProblems.map(id => id.toString()));
        }

        const problemsWithSolved = problems.map(p => ({
            ...p.toObject(),
            isSolved: solvedSet.has(p._id.toString()),
        }));

        return res.status(200).json({ success: true, total, page: Number(page), problems: problemsWithSolved });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const getProblemBySlug = async (req, res) => {
    try {
        const problem = await Problem.findOne({ slug: req.params.slug });
        if (!problem) return res.status(404).json({ message: "Problem not found." });
        return res.status(200).json({ success: true, problem });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const getProblemById = async (req, res) => {
    try {
        const problem = await Problem.findById(req.params.id);
        if (!problem) return res.status(404).json({ message: "Problem not found." });
        return res.status(200).json({ success: true, problem });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const updateProblem = async (req, res) => {
    try {
        const {
            title, slug, difficulty, status, category,
            topics, companies, description, constraints,
            examples, hints, followUp, editorial, editorialData,
            testCases, starterCode, solutions,
        } = req.body;

        if (slug) {
            const conflict = await Problem.findOne({ slug, _id: { $ne: req.params.id } });
            if (conflict)
                return res.status(409).json({ message: `Slug "${slug}" is already used by another problem.` });
        }

        const updated = await Problem.findByIdAndUpdate(
            req.params.id,
            {
                ...(title !== undefined && { title }),
                ...(slug !== undefined && { slug }),
                ...(difficulty !== undefined && { difficulty }),
                ...(status !== undefined && { status }),
                ...(category !== undefined && { category }),
                ...(topics !== undefined && { topics }),
                ...(companies !== undefined && { companies }),
                ...(description !== undefined && { description }),
                ...(constraints !== undefined && { constraints }),
                ...(examples !== undefined && { examples }),
                ...(hints !== undefined && { hints }),
                ...(followUp !== undefined && { followUp }),
                ...(editorial !== undefined && { editorial }),
                ...(editorialData !== undefined && { editorialData }),
                ...(testCases !== undefined && { testCases }),
                ...(starterCode !== undefined && { starterCode }),
                ...(solutions !== undefined && { solutions }),
            },
            { new: true, runValidators: true }
        );

        if (!updated) return res.status(404).json({ message: "Problem not found." });
        return res.status(200).json({ success: true, problem: updated });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

export const deleteProblem = async (req, res) => {
    try {
        const deleted = await Problem.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: "Problem not found." });
        return res.status(200).json({ success: true, message: "Problem deleted successfully." });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  CODE EXECUTION
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/problem/:slug/run
export const runCode = async (req, res) => {
    try {
        const { code, language, testInput } = req.body;
        if (!code || !language)
            return res.status(400).json({ message: "code and language are required." });

        const languageId = LANGUAGE_IDS[language];
        if (!languageId)
            return res.status(400).json({ message: `Unsupported language: ${language}` });

        const problem = await Problem.findOne({ slug: req.params.slug });
        if (!problem) return res.status(404).json({ message: "Problem not found." });

        // Determine cases to run
        let casesToRun;
        if (testInput) {
            casesToRun = [{ input: testInput, expectedOutput: "", isSample: true }];
        } else {
            casesToRun = problem.testCases.filter((tc) => tc.isSample).slice(0, 3);
        }

        if (casesToRun.length === 0)
            return res.status(400).json({ message: "No sample test cases configured for this problem." });

        // ── Check key before burning a request ───────────────────────────────
        try { buildHeaders(); } catch (e) {
            return res.status(503).json({
                success: false,
                message: e.message,
                providerError: "CONFIG",
            });
        }

        const results = await runCasesSequentially(code, languageId, casesToRun);

        // If the very first case hit a provider error, surface it clearly
        const providerErr = results.find((r) => r.providerError);
        if (providerErr) {
            return res.status(200).json({
                success: false,
                status: providerErr.status,
                providerError: providerErr.providerError,
                message: providerErr.actual,   // the human-readable message
                cases: results,
            });
        }

        const allPassed = results.every((r) => r.passed);
        const overallStatus = allPassed
            ? "Accepted"
            : results.find((r) => !r.passed)?.status || "Wrong Answer";

        return res.status(200).json({
            success: true,
            status: overallStatus,
            runtime: results[0]?.time || "—",
            memory: results[0]?.memory || "—",
            cases: results,
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// POST /api/problem/:slug/submit
// export const submitCode = async (req, res) => {
//     try {
//         const { code, language } = req.body;
//         if (!code || !language)
//             return res.status(400).json({ message: "code and language are required." });

//         const languageId = LANGUAGE_IDS[language];
//         if (!languageId)
//             return res.status(400).json({ message: `Unsupported language: ${language}` });

//         const problem = await Problem.findOne({ slug: req.params.slug });
//         if (!problem) return res.status(404).json({ message: "Problem not found." });

//         if (!problem.testCases || problem.testCases.length === 0)
//             return res.status(400).json({ message: "No test cases configured for this problem." });

//         // ── Check key before burning a request ───────────────────────────────
//         try { buildHeaders(); } catch (e) {
//             return res.status(503).json({
//                 success: false,
//                 message: e.message,
//                 providerError: "CONFIG",
//             });
//         }

//         // Run ALL cases sequentially; hide non-sample details
//         const results = await runCasesSequentially(
//             code,
//             languageId,
//             problem.testCases,
//             1100,   // 1.1 s between each submission
//             true    // hideNonSample
//         );

//         // Surface provider errors immediately
//         const providerErr = results.find((r) => r.providerError);
//         if (providerErr) {
//             return res.status(200).json({
//                 success: false,
//                 status: providerErr.status,
//                 providerError: providerErr.providerError,
//                 message: providerErr.actual,
//                 cases: results,
//             });
//         }

//         const allPassed = results.every((r) => r.passed);
//         const passedCount = results.filter((r) => r.passed).length;

//         // If all passed, add to user's solvedProblems (no duplicates)
//         // Await the write so the next /all fetch returns consistent isSolved data
//         if (allPassed && req.userId) {
//             try {
//                 await User.findByIdAndUpdate(req.userId, {
//                     $addToSet: { solvedProblems: problem._id },
//                 });
//             } catch (_) { } // non-critical
//         }

//         // Update stats asynchronously (don't block response)
//         Problem.findByIdAndUpdate(problem._id, {
//             $inc: {
//                 totalSubmissions: 1,
//                 acceptedSubmissions: allPassed ? 1 : 0,
//             },
//         })
//             .then(() => Problem.findById(problem._id).select("totalSubmissions acceptedSubmissions"))
//             .then((p) => {
//                 if (p && p.totalSubmissions > 0) {
//                     p.acceptanceRate = Math.round((p.acceptedSubmissions / p.totalSubmissions) * 100);
//                     return p.save();
//                 }
//             })
//             .catch(() => { }); // non-critical

//         const overallStatus = allPassed
//             ? "Accepted"
//             : results.find((r) => !r.passed)?.status || "Wrong Answer";

//         return res.status(200).json({
//             success: true,
//             status: overallStatus,
//             passed: passedCount,
//             total: results.length,
//             runtime: results[0]?.time || "—",
//             memory: results[0]?.memory || "—",
//             cases: results,
//         });
//     } catch (error) {
//         return res.status(500).json({ message: error.message });
//     }
// };
export const submitCode = async (req, res) => {
    try {
        const { code, language } = req.body;
        if (!code || !language)
            return res.status(400).json({ message: "code and language are required." });

        const languageId = LANGUAGE_IDS[language];
        if (!languageId)
            return res.status(400).json({ message: `Unsupported language: ${language}` });

        const problem = await Problem.findOne({ slug: req.params.slug });
        if (!problem) return res.status(404).json({ message: "Problem not found." });

        if (!problem.testCases || problem.testCases.length === 0)
            return res.status(400).json({ message: "No test cases configured for this problem." });

        // ── Check key before burning a request ──────────────────────
        try { buildHeaders(); } catch (e) {
            return res.status(503).json({
                success: false,
                message: e.message,
                providerError: "CONFIG",
            });
        }

        // Run ALL cases sequentially; hide non-sample details
        const results = await runCasesSequentially(
            code,
            languageId,
            problem.testCases,
            1100,   // 1.1 s between each submission
            true    // hideNonSample
        );

        // Surface provider errors immediately
        const providerErr = results.find((r) => r.providerError);
        if (providerErr) {
            return res.status(200).json({
                success: false,
                status: providerErr.status,
                providerError: providerErr.providerError,
                message: providerErr.actual,
                cases: results,
            });
        }

        const allPassed = results.every((r) => r.passed);
        const passedCount = results.filter((r) => r.passed).length;

        const overallStatus = allPassed
            ? "Accepted"
            : results.find((r) => !r.passed)?.status || "Wrong Answer";

        const currentUserId = req.user?._id || req.userId;

        // ── 1. SAVE SUBMISSION HISTORY (New Addition) ──────────────
        if (currentUserId) {
            try {
                await Submission.create({
                    userId: currentUserId,
                    problemId: problem._id,
                    code,
                    language,
                    status: overallStatus,
                    runtime: results[0]?.time || "—",
                    memory: results[0]?.memory || "—",
                    errorDetails: results.find((r) => !r.passed)?.actual || ""
                });
            } catch (err) {
                console.error("Failed to save submission history:", err.message);
            }
        }

        // ── 2. Update user's solvedProblems if all passed ───────────
        if (allPassed && currentUserId) {
            try {
                await User.findByIdAndUpdate(currentUserId, {
                    $addToSet: { solvedProblems: problem._id },
                });
            } catch (_) { } // non-critical
        }

        // ── 3. Update stats asynchronously ──────────────────────────
        Problem.findByIdAndUpdate(problem._id, {
            $inc: {
                totalSubmissions: 1,
                acceptedSubmissions: allPassed ? 1 : 0,
            },
        })
            .then(() => Problem.findById(problem._id).select("totalSubmissions acceptedSubmissions"))
            .then((p) => {
                if (p && p.totalSubmissions > 0) {
                    p.acceptanceRate = Math.round((p.acceptedSubmissions / p.totalSubmissions) * 100);
                    return p.save();
                }
            })
            .catch(() => { }); // non-critical

        return res.status(200).json({
            success: true,
            status: overallStatus,
            passed: passedCount,
            total: results.length,
            runtime: results[0]?.time || "—",
            memory: results[0]?.memory || "—",
            cases: results,
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
// User ki past submissions fetch karne ke liye (Submissions Tab ke liye)
export const getSubmissions = async (req, res) => {
    try {
        const { slug } = req.params;
        const currentUserId = req.user?._id || req.userId;

        const problem = await Problem.findOne({ slug });
        if (!problem) {
            return res.status(404).json({ success: false, message: "Problem not found." });
        }

        // Latest submissions pehle dikhane ke liye sort({ createdAt: -1 }) use kiya hai
        const submissions = await Submission.find({ 
            userId: currentUserId, 
            problemId: problem._id 
        }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            submissions
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

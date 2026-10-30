import express from "express";
import { createDiscussion, getAllDiscussions, getDiscussionById, getDiscussionsByProblem } from "./discussion.controller.js";
import { userAuth } from "../../middleware/userAuth.js";

const router = express.Router();

router.get("/", getAllDiscussions);
router.post("/create", userAuth, createDiscussion);
router.get("/problem/:problemId", getDiscussionsByProblem);
router.get("/:id", getDiscussionById);

export default router;
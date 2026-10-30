import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import userRouter from "./modules/users/user.routes.js";
import problemRouter from "./modules/problem/problem.routes.js";
import discussionRoutes from "./modules/discussion/discussion.routes.js";
const app = express();

app.use(
  cors({
    origin: ["https://code-shah-front.vercel.app", "http://localhost:3000", "http://localhost:5174"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/user", userRouter);
app.use("/api/problem", problemRouter);
app.use("/api/discussions", discussionRoutes);
app.get("/", (req, res) => {
  res.send("CodePlatform API is running.");
});

export default app;

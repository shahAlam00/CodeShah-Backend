
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import connectDB from "./config/db.js";

import userRouter from "./modules/users/user.routes.js";
import problemRouter from "./modules/problem/problem.routes.js";
import discussionRoutes from "./modules/discussion/discussion.routes.js";

const app = express();

app.use(
  cors({
    origin: [
      "https://code-shah-front.vercel.app",
      "http://localhost:3000",
      "http://localhost:5174",
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// MongoDB connection before API routes
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("Database middleware error:", error.message);

    return res.status(503).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

// Routes
app.use("/api/user", userRouter);
app.use("/api/problem", problemRouter);
app.use("/api/discussions", discussionRoutes);

app.get("/", (req, res) => {
  res.send("CodePlatform API is running.");
});

export default app;

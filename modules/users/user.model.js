import mongoose from "mongoose"


const userSchema = new mongoose.Schema(
  {
    // Basic Information
    fullName: {
      type: String,
      required: true,
      trim: true
    },

    username: {
      type: String,
      unique: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },

    password: {
      type: String,
      required: true
    },

    // Profile Information
    avatar: {
      type: String,
      default: ""
    },

    location: {
      type: String,
      default: ""
    },

    bio: {
      type: String,
      default: ""
    },

    githubUrl: {
      type: String,
      default: ""
    },

    linkedinUrl: {
      type: String,
      default: ""
    },

    website: {
      type: String,
      default: ""
    },

    // Role
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user"
    },

    // Solved Problems
    solvedProblems: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Problem"
    }]
  },
  {
    timestamps: true
  }
);

const User = mongoose.model("User", userSchema);

export default User;
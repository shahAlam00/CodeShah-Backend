
import mongoose from "mongoose";

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = {
    conn: null,
    promise: null,
  };
}

const connectDB = async () => {
  try {
    if (cached.conn && mongoose.connection.readyState === 1) {
      return cached.conn;
    }

    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing in environment variables");
    }

    if (!cached.promise) {
      cached.promise = mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
      });
    }

    cached.conn = await cached.promise;

    console.log(
      `MongoDB Connected: ${cached.conn.connection.host}`
    );

    return cached.conn;

  } catch (error) {
    cached.promise = null;
    cached.conn = null;

    console.error("MongoDB connection error:", error.message);

    throw error;
  }
};

export default connectDB;

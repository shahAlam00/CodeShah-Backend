import User from "./user.model.js"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { uploadOnCloudinary } from "../../utils/cloudinaryUpload.js"; // Apne path ke mutabiq import karein
export const userRegister = async (req, res) => {
  try {
    const { fullName, email, password, confirmPassword } = req.body;
    if (!fullName || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: "Please fill all the fields" })
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" })
    }

    const hashePassword = await bcrypt.hash(password, 10);
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" })
    }
    const user = await User.create({
      fullName,
      email,
      password: hashePassword
    })
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" })
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000
    })
    return res.status(201).json({
      success: true,
      token,
      user
    })

  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

export const userLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Please fill all the fields" })
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User does not exist" })
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" })
    }
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1d" })
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000
    })
    return res.status(200).json({
      success: true,
      token,
      user
    })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

export const userLogout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
    return res.status(200).json({ message: "Logged out successfully" })
  } catch (error) {
    return res.status(500).json({ message: error.message })
  }
}

export const getUserProfile = async (req, res) => {
  try {
    console.log("req.userId:", req.userId);

    const user = await User.findById(req.userId).select("-password");



    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    return res.status(200).json({
      user
    });

  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};


export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.userId;

    const {
      fullName,
      username,
      location,
      bio,
      githubUrl,
      linkedinUrl,
      website,
    } = req.body;

    let avatarUrl;

    if (req.file) {
      try {
        const cloudinaryResponse = await uploadOnCloudinary(req.file.buffer);
        if (cloudinaryResponse?.secure_url) {
          avatarUrl = cloudinaryResponse.secure_url;
        }
      } catch (uploadErr) {
        // Surface a clear error instead of swallowing it
        const code = uploadErr.httpCode || 500;

        // 403 = Cloudinary permissions not set up on this account
        if (code === 403) {
          return res.status(503).json({
            message:
              'Image upload is not available right now. ' +
              'Cloudinary API key does not have upload permissions. ' +
              'Go to cloudinary.com → Settings → Access Keys and enable Upload for key ' +
              (process.env.CLOUDINARY_API_KEY?.slice(0, 6) || '?') + '...',
            cloudinaryError: uploadErr.message,
          });
        }

        return res.status(500).json({
          message: `Image upload failed: ${uploadErr.message}`,
        });
      }
    }

    const updateFields = {
      ...(fullName !== undefined && { fullName }),
      ...(username !== undefined && { username }),
      ...(location !== undefined && { location }),
      ...(bio !== undefined && { bio }),
      ...(githubUrl !== undefined && { githubUrl }),
      ...(linkedinUrl !== undefined && { linkedinUrl }),
      ...(website !== undefined && { website }),
      ...(avatarUrl !== undefined && { avatar: avatarUrl }),
    };

    const user = await User.findByIdAndUpdate(
      userId,
      updateFields,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
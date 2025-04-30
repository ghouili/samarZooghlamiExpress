const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { moveFile, cleanupFile } = require("../middlewares/Fileuploader"); // Import file handling utilities
const path = require("path");

// Login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (!user.active) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated",
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      success: true,
      data: { user: userResponse, token },
      message: "Login successful",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Create a new user
const createUser = async (req, res) => {
  let tempFilePath = req.file?.path; // Store temp path for cleanup
  try {
    const userData = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      code: req.body.code,
      password: req.body.password,
      post: req.body.post,
      role: req.body.role,
      active: req.body.active !== undefined ? req.body.active : true,
    };

    const user = new User(userData);
    const savedUser = await user.save();

    // Move file from temp to permanent storage
    if (tempFilePath) {
      const finalPath = await moveFile(tempFilePath);
      savedUser.picture = finalPath;
      await savedUser.save();
      tempFilePath = null; // Clear temp path after successful move
    }

    const token = jwt.sign(
      { id: savedUser._id, email: savedUser.email, role: savedUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    const userResponse = savedUser.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      data: { user: userResponse, token },
      message: "User created successfully",
    });
  } catch (error) {
    if (tempFilePath) {
      await cleanupFile(tempFilePath); // Clean up temp file on failure
    }
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all users
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = "createdAt" } = req.query;
    const users = await User.find()
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort(sort)
      .select("-password");

    const total = await User.countDocuments();

    res.status(200).json({
      success: true,
      data: users,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Get single user by ID
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update user
const updateUser = async (req, res) => {
  let tempFilePath = req.file?.path; // Store temp path for cleanup
  try {
    const updates = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      code: req.body.code,
      email: req.body.email,
      post: req.body.post,
      role: req.body.role,
      active: req.body.active,
    };

    // Remove undefined fields
    Object.keys(updates).forEach(
      (key) => updates[key] === undefined && delete updates[key]
    );

    // Find existing user
    const existingUser = await User.findById(req.params.id);
    if (!existingUser) {
      if (tempFilePath) await cleanupFile(tempFilePath);
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Delete old picture if a new one is uploaded and it's not the default
    if (
      tempFilePath &&
      existingUser.picture &&
      existingUser.picture !== "avatar.png"
    ) {
      await cleanupFile(existingUser.picture);
    }

    // Move new file to permanent storage
    if (tempFilePath) {
      updates.picture = await moveFile(tempFilePath);
      tempFilePath = null; // Clear temp path after successful move
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { ...updates, updatedAt: Date.now() },
      { new: true, runValidators: true }
    ).select("-password");

    res.status(200).json({
      success: true,
      data: user,
      message: "User updated successfully",
    });
  } catch (error) {
    if (tempFilePath) {
      await cleanupFile(tempFilePath); // Clean up temp file on failure
    }
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Delete picture file if it exists and isn't the default
    if (user.picture && user.picture !== "avatar.png") {
      await cleanupFile(user.picture);
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const isMatch = await user.comparePassword(req.body.oldPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Incorrect old password",
      });
    }

    user.password = req.body.newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  loginUser,
  createUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  changePassword,
};

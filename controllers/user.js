const User = require("../models/user");
const Project = require("../models/project");
const { moveFile, cleanupFile } = require("../middlewares/Fileuploader");
const generator = require("generate-password");
const jwt = require("jsonwebtoken");
const ExcelJS = require("exceljs");
const mongoose = require("mongoose");
const sendUserCreatedMail = require("./mailer");

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
      {
        id: user._id,
        email: user.email,
        name: user.firstName + " " + user.lastName,
        role: user.role,
        picture: user.picture,
      },
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
  let tempFilePath = req.file?.path;

  let password;
  if (!req.body.password) {
    password = generator.generate({
      length: 8,
      uppercase: true,
      numbers: true,
      symbols: true,
    });
  } else {
    password = req.body.password;
  }

  try {
    const { projectId } = req.body;
    console.log(req.body);
    if (projectId) {
      console.log(projectId);

      let projectExists = null;
      if (projectId || mongoose.Types.ObjectId.isValid(projectId)) {
        projectExists = await Project.findById(projectId);
        if (!projectExists) {
          throw new Error("Project not found");
        }
      }
    }

    const userData = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      code: req.body.code,
      email: req.body.email,
      password,
      role: req.body.role || "user",
      active: req.body.active !== undefined ? req.body.active : true,
      post_hr: req.body.post_hr,
      post: req.body.post,
      affectation: req.body.affectation || "Indirect",
      dept: req.body.dept || "PPE",
      projectId: req.body.projectId || null,
    };
    // if (projectId) {
    // }
    // console.log(userData);

    const user = new User(userData);
    const savedUser = await user.save();

    // Send a welcome email to the new user
    await sendUserCreatedMail({
      email: userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role,
      password,
    });

    if (tempFilePath) {
      const finalPath = await moveFile(tempFilePath);
      savedUser.picture = finalPath || "avatar.png";
      await savedUser.save();
      tempFilePath = null;
    }

    const token = jwt.sign(
      {
        id: savedUser._id,
        email: savedUser.email,
        role: savedUser.role,
        picture: savedUser.picture,
      },
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
      await cleanupFile(tempFilePath);
    }
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email or code already exists",
      });
    }
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all users
// const getAllUsers = async (req, res) => {
//   try {
//     const { page = 1, limit = 10, sort = "createdAt", search = "" } = req.query;
//     let query = {};
//     if (search) {
//       const searchRegex = new RegExp(search, "i");
//       query = {
//         $or: [
//           { firstName: searchRegex },
//           { lastName: searchRegex },
//           { code: searchRegex },
//           { email: searchRegex },
//         ],
//       };
//     }
//     const users = await User.find(query)
//       .limit(limit * 1)
//       .skip((page - 1) * limit)
//       .sort(sort).populate("projectId")
//       .select("-password");

//     const total = await User.countDocuments(query);

//     res.status(200).json({
//       success: true,
//       data: users,
//       total,
//       pages: Math.ceil(total / limit),
//       currentPage: page,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// Get all users with optional pagination and project data import
const getAllUsers = async (req, res) => {
  try {
    const { page, limit, sort = "createdAt", search } = req.query;

    // Determine if pagination params are provided
    const hasPagination = page !== undefined && limit !== undefined;
    const limitNum = hasPagination ? parseInt(limit, 10) : null;
    const pageNum = hasPagination ? parseInt(page, 10) : null;

    // Build search query
    let filter = {};
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter = {
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { code: searchRegex },
          { email: searchRegex },
        ],
      };
    }

    // Build Mongoose query
    let query = User.find(filter)
      .sort({ [sort]: -1 })
      .select("-password")
      .populate("projectId");

    // Apply pagination if requested
    if (hasPagination) {
      query = query.skip((pageNum - 1) * limitNum).limit(limitNum);
    }

    // Execute query
    const users = await query.exec();

    // Count total documents
    const total = await User.countDocuments(filter);

    // Build response
    const response = {
      success: true,
      data: users,
      total,
    };

    if (hasPagination) {
      response.pages = Math.ceil(total / limitNum);
      response.currentPage = pageNum;
    }

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = { getAllUsers };

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
  let tempFilePath = req.file?.path;

  try {
    const updates = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      code: req.body.code,
      email: req.body.email,
      post: req.body.post,
      affectation: req.body.affectation,
      dept: req.body.dept,
      projectId: req.body.projectId, // Updated from project to projectId
      role: req.body.role,
      active: req.body.active,
    };

    Object.keys(updates).forEach(
      (key) => updates[key] === undefined && delete updates[key]
    );

    if (updates.projectId) {
      if (!mongoose.Types.ObjectId.isValid(updates.projectId)) {
        throw new Error("Invalid Project ID");
      }
      const projectExists = await Project.findById(updates.projectId);
      if (!projectExists) {
        throw new Error("Project not found");
      }
    }

    const existingUser = await User.findById(req.params.id);
    if (!existingUser) {
      if (tempFilePath) await cleanupFile(tempFilePath);
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (
      tempFilePath &&
      existingUser.picture &&
      existingUser.picture !== "avatar.png"
    ) {
      await cleanupFile(existingUser.picture);
    }

    if (tempFilePath) {
      updates.picture = (await moveFile(tempFilePath)) || "avatar.png";
      tempFilePath = null;
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
      await cleanupFile(tempFilePath);
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

// New API to import employees from Excel
const importEmployees = async (req, res) => {
  let tempFilePath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(tempFilePath);
    const worksheet = workbook.getWorksheet(1);
    const employees = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      employees.push({
        code: row.getCell(1).value?.toString(),
        firstName: row.getCell(2).value,
        lastName: row.getCell(3).value,
        dept: row.getCell(4).value || "PPE",
        projectId: null,
        post_hr: row.getCell(6).value || "Sampling",
        post: row.getCell(7).value || null,
        affectation: row.getCell(8).value || "Indirect",
        email: row.getCell(9).value?.text,
      });
      // console.log(row.getCell(9).value?.text);
      // console.log(employees);
    });

    const importedUsers = [];
    const errors = [];

    for (const emp of employees) {
      try {
        // Generate a random 8-character password.
        const plainPassword = generator.generate({
          length: 8,
          uppercase: true,
          numbers: true,
          symbols: true,
        });

        const userData = {
          ...emp,
          password: plainPassword,
          role: "user",
          active: true,
        };
        // console.log('in the for');
        // console.log(userData);
        // Check if user already exists
        const existingUser = await User.findOne({ code: userData.code });
        if (existingUser) {
          errors.push(
            `User with name ${userData.firstName} ${userData.firstName} already exists`
          );
          continue;
        }

        const user = new User(userData);
        const savedUser = await user.save();
        importedUsers.push({
          code: savedUser.code,
          firstName: savedUser.firstName,
          lastName: savedUser.lastName,
        });

        // Send a welcome email to the new user
        await sendUserCreatedMail({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
          password: plainPassword,
        });
      } catch (err) {
        console.log(err.message);

        errors.push(`Error importing user ${emp["code"]}: ${err.message}`);
      }
    }

    // Clean up temporary Excel file
    await cleanupFile(tempFilePath);

    res.status(200).json({
      success: true,
      data: {
        imported: importedUsers.length,
        users: importedUsers,
        errors: errors.length > 0 ? errors : undefined,
      },
      message: `Imported ${importedUsers.length} users successfully`,
    });
  } catch (error) {
    if (tempFilePath) {
      await cleanupFile(tempFilePath);
    }
    res.status(500).json({
      success: false,
      message: `Failed to import employees: ${error.message}`,
    });
  }
};

// Delete all users
const deleteAllUsers = async (req, res) => {
  try {
    const { confirm } = req.query;
    if (confirm !== "DELETE_ALL") {
      return res.status(400).json({
        success: false,
        message:
          "Confirmation required. Provide ?confirm=DELETE_ALL in the query.",
      });
    }
    console.log("here");

    const result = await User.deleteMany({});

    res.status(200).json({
      success: true,
      data: {
        deletedCount: result.deletedCount,
      },
      message: `Successfully deleted ${result.deletedCount} users`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Failed to delete users: ${error.message}`,
    });
  }
};

// Update active status
const UdateActiveStatus = async (req, res) => {
  try {
    const existingUser = await User.findById(req.params.id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    existingUser.active = !existingUser.active;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { ...existingUser, updatedAt: Date.now() },
      { new: true, runValidators: true }
    ).select("-password");

    res.status(200).json({
      success: true,
      data: user,
      message: "User updated successfully",
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
  importEmployees,
  deleteAllUsers,
  UdateActiveStatus,
};

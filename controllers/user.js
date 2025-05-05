const User = require("../models/user");
const { moveFile, cleanupFile } = require("../middlewares/Fileuploader");

const generator = require("generate-password");
const jwt = require("jsonwebtoken");
const ExcelJS = require("exceljs");
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
      project: req.body.project || "Common",
    };

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
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = "createdAt", search = "" } = req.query;
    let query = {};
    if (search) {
      const searchRegex = new RegExp(search, "i");
      query = {
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { code: searchRegex },
          { email: searchRegex },
        ],
      };
    }
    const users = await User.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort(sort)
      .select("-password");

    const total = await User.countDocuments(query);

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
      project: req.body.project,
      role: req.body.role,
      active: req.body.active,
    };

    Object.keys(updates).forEach(
      (key) => updates[key] === undefined && delete updates[key]
    );

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
        project: row.getCell(5).value || "Common",
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
    const { confirm } = req.params;
    console.log(confirm);

    if (confirm !== "DELETE_ALL") {
      return res.status(400).json({
        success: false,
        message:
          "Confirmation required. Provide ?confirm=DELETE_ALL in the query.",
      });
    }

    // Fetch all users to delete their pictures
    // const users = await User.find().select("picture");
    // for (const user of users) {
    //   if (user.picture && user.picture !== "avatar.png") {
    //     await cleanupFile(user.picture);
    //   }
    // }

    // Delete all users from the collection
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

// Update user
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
    if (tempFilePath) {
      await cleanupFile(tempFilePath);
    }
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

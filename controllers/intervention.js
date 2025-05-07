const mongoose = require("mongoose");
const Intervention = require("../models/intervention");
const User = require("../models/user");
const Project = require("../models/project");

// Create a new intervention
const createIntervention = async (req, res) => {
  try {
    const { userId, projectId, description, type, status } = req.body;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }
    const userExists = await User.findById(userId);
    if (!userExists) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Validate projectId
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }
    const projectExists = await Project.findById(projectId);
    if (!projectExists) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const interventionData = {
      userId,
      projectId,
      description,
      type,
      status,
    };

    const intervention = new Intervention(interventionData);
    const savedIntervention = await intervention.save();

    // Populate user and project details in response
    const populatedIntervention = await Intervention.findById(
      savedIntervention._id
    )
      .populate("userId", "firstName lastName")
      .populate("projectId", "code");

    res.status(201).json({
      success: true,
      data: populatedIntervention,
      message: "Intervention created successfully",
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all interventions
const getAllInterventions = async (req, res) => {
  try {
    const { page, limit, sort = "createdAt", search } = req.query;
    // const { page = 1, limit = 10, sort = "createdAt", search = "" } = req.query;

    console.log(req.query); // Log the query parameters for debugging

    // Convert limit and page to numbers
    const limitNum = parseInt(limit) || 10;
    const pageNum = parseInt(page) || 1;

    // Define the search regex only if search term is provided
    const searchRegex = search != "" ? new RegExp(search, "i") : null;

    // Base aggregation pipeline
    const pipeline = [
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $lookup: {
          from: "projects",
          localField: "projectId",
          foreignField: "_id",
          as: "project",
        },
      },
      {
        $unwind: "$user",
      },
      {
        $unwind: "$project",
      },
    ];

    // Add search filter only if search term exists
    if (searchRegex) {
      pipeline.push({
        $match: {
          $or: [
            { description: searchRegex },
            { "user.firstName": searchRegex },
            { "user.lastName": searchRegex },
            { "user.code": searchRegex },
            { "user.email": searchRegex },
            { "user.post": searchRegex },
            { "project.code": searchRegex },
            { "project.cmn": searchRegex },
            { "project.refTSK": searchRegex },
          ],
        },
      });
    }

    // Add sorting, skip, and limit for pagination
    pipeline.push({ $sort: { [sort]: 1 } });
    pipeline.push({ $skip: (pageNum - 1) * limitNum });
    pipeline.push({ $limit: limitNum });

    // Execute the main pipeline to fetch interventions
    const interventions = await Intervention.aggregate(pipeline);

    // Create a separate pipeline for total count (exclude skip and limit)
    const totalPipeline = [...pipeline.slice(0, -2)]; // Remove $skip and $limit
    const totalResult = await Intervention.aggregate([
      ...totalPipeline,
      { $count: "total" },
    ]);
    const total = totalResult.length > 0 ? totalResult[0].total : 0;

    // Send the response
    res.status(200).json({
      success: true,
      data: interventions,
      total,
      pages: Math.ceil(total / limitNum),
      currentPage: pageNum,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// Get single intervention by ID
const getInterventionById = async (req, res) => {
  try {
    const intervention = await Intervention.findById(req.params.id)
      .populate("userId", "firstName lastName")
      .populate("projectId", "code");
    if (!intervention) {
      return res.status(404).json({
        success: false,
        message: "Intervention not found",
      });
    }
    res.status(200).json({
      success: true,
      data: intervention,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update intervention
const updateIntervention = async (req, res) => {
  try {
    const { userId, projectId, description, type, status } = req.body;

    const updates = {
      userId,
      projectId,
      description,
      type,
      status,
    };

    Object.keys(updates).forEach(
      (key) => updates[key] === undefined && delete updates[key]
    );

    // Validate userId if provided
    if (updates.userId) {
      if (!mongoose.Types.ObjectId.isValid(updates.userId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });
      }
      const userExists = await User.findById(updates.userId);
      if (!userExists) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
    }

    // Validate projectId if provided
    if (updates.projectId) {
      if (!mongoose.Types.ObjectId.isValid(updates.projectId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid project ID",
        });
      }
      const projectExists = await Project.findById(updates.projectId);
      if (!projectExists) {
        return res.status(404).json({
          success: false,
          message: "Project not found",
        });
      }
    }

    const intervention = await Intervention.findByIdAndUpdate(
      req.params.id,
      { ...updates, updatedAt: Date.now() },
      { new: true, runValidators: true }
    )
      .populate("userId", "firstName lastName")
      .populate("projectId", "code");

    if (!intervention) {
      return res.status(404).json({
        success: false,
        message: "Intervention not found",
      });
    }

    res.status(200).json({
      success: true,
      data: intervention,
      message: "Intervention updated successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete intervention
const deleteIntervention = async (req, res) => {
  try {
    const intervention = await Intervention.findById(req.params.id);
    if (!intervention) {
      return res.status(404).json({
        success: false,
        message: "Intervention not found",
      });
    }

    await Intervention.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Intervention deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete all interventions
const deleteAllInterventions = async (req, res) => {
  try {
    const { confirm } = req.query;

    if (confirm !== "DELETE_ALL") {
      return res.status(400).json({
        success: false,
        message:
          "Confirmation required. Provide ?confirm=DELETE_ALL in the query.",
      });
    }

    const result = await Intervention.deleteMany({});

    res.status(200).json({
      success: true,
      data: {
        deletedCount: result.deletedCount,
      },
      message: `Successfully deleted ${result.deletedCount} interventions`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Failed to delete interventions: ${error.message}`,
    });
  }
};

module.exports = {
  createIntervention,
  getAllInterventions,
  getInterventionById,
  updateIntervention,
  deleteIntervention,
  deleteAllInterventions,
};

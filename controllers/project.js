const Project = require("../models/project");
const ExcelJS = require("exceljs");
const { cleanupFile } = require("../middlewares/Fileuploader");

// Create a new project
const createProject = async (req, res) => {
  console.log(req.body);

  try {
    const projectData = {
      code: req.body.code,
      cmn: req.body.cmn,
      refTSK: req.body.refTSK,
      qte: req.body.qte,
      pin: req.body.pin,
      sap1: req.body.sap1,
      sap2: req.body.sap2,
      refS: req.body.refS,
    };
    // check if code exisit
    console.log(projectData);

    const project = new Project(projectData);
    const savedProject = await project.save();

    res.status(201).json({
      success: true,
      data: savedProject,
      message: "Project created successfully",
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Project code already exists",
      });
    }
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all projects
// const getAllProjects = async (req, res) => {
//   try {
//     const { page, limit, sort = "createdAt", search } = req.query;
//     // const { page = 1, limit = 10, sort = "createdAt", search = "" } = req.query;

//     const limitNum = parseInt(limit) || 1; // Default limit to 1 if not provided
//     const pageNum = parseInt(page) || 10; // Default limit to 10 if not provided

//     const searchRegex = search ? new RegExp(search, "i") : null;

//     const pipeline = [
//       {
//         $lookup: {
//           from: "equipments",
//           localField: "equipments",
//           foreignField: "_id",
//           as: "equipments",
//         },
//       },
//     ];

//     if (searchRegex) {
//       pipeline.push({
//         $match: {
//           $or: [
//             { code: searchRegex },
//             { cmn: searchRegex },
//             { refTSK: searchRegex },
//             { refS: searchRegex },
//             { "equipments.assetNumber": searchRegex }, // Search in populated equipments.assetNumber
//           ],
//         },
//       });
//     }

//     // Add sorting, skip, and limit for pagination
//     pipeline.push({ $sort: { [sort]: -1 } }); // Maintain original descending sort
//     pipeline.push({ $skip: (pageNum - 1) * limitNum });
//     pipeline.push({ $limit: limitNum });

//     // Execute the main pipeline to fetch projects
//     const projects = await Project.aggregate(pipeline);

//     // Create a separate pipeline for total count (exclude skip and limit)
//     const totalPipeline = [...pipeline.slice(0, -2)]; // Remove $skip and $limit
//     const totalResult = await Project.aggregate([
//       ...totalPipeline,
//       { $count: "total" },
//     ]);
//     const total = totalResult.length > 0 ? totalResult[0].total : 0;

//     res.status(200).json({
//       success: true,
//       data: projects,
//       total,
//       pages: Math.ceil(total / limitNum),
//       currentPage: pageNum,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

const getAllProjects = async (req, res) => {
  try {
    const { page, limit, sort = "createdAt", search } = req.query;

    // Parse pagination parameters if provided
    const hasPagination = page !== undefined && limit !== undefined;
    const limitNum = hasPagination ? parseInt(limit, 10) : null;
    const pageNum = hasPagination ? parseInt(page, 10) : null;

    const searchRegex = search ? new RegExp(search, "i") : null;

    // Base aggregation pipeline with lookup and optional search
    const pipeline = [
      {
        $lookup: {
          from: "equipments",
          localField: "equipments",
          foreignField: "_id",
          as: "equipments",
        },
      },
    ];

    if (searchRegex) {
      pipeline.push({
        $match: {
          $or: [
            { code: searchRegex },
            { cmn: searchRegex },
            { refTSK: searchRegex },
            { refS: searchRegex },
            { "equipments.assetNumber": searchRegex },
          ],
        },
      });
    }

    // Always sort
    pipeline.push({ $sort: { [sort]: -1 } });

    // Conditionally add pagination stages
    if (hasPagination) {
      pipeline.push({ $skip: (pageNum - 1) * limitNum });
      pipeline.push({ $limit: limitNum });
    }

    // Execute aggregation to fetch projects
    const projects = await Project.aggregate(pipeline);

    // Get total count (without pagination stages)
    const countPipeline = pipeline.filter((stage) => {
      return !("$skip" in stage) && !("$limit" in stage);
    });
    countPipeline.push({ $count: "total" });
    const totalResult = await Project.aggregate(countPipeline);
    const total = totalResult.length > 0 ? totalResult[0].total : 0;

    // Prepare pagination info
    const response = {
      success: true,
      data: projects,
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

// Get single project by ID
const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).populate(
      "equipments"
    );
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }
    res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update project
const updateProject = async (req, res) => {
  try {
    const updates = {
      code: req.body.code,
      cmn: req.body.cmn,
      refTSK: req.body.refTSK,
      qte: req.body.qte,
      pin: req.body.pin,
      sap1: req.body.sap1,
      sap2: req.body.sap2,
      refS: req.body.refS,
    };

    // Remove undefined fields
    Object.keys(updates).forEach(
      (key) => updates[key] === undefined && delete updates[key]
    );

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { ...updates, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    res.status(200).json({
      success: true,
      data: project,
      message: "Project updated successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete project
const deleteProject = async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Project deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete all projects
const deleteAllProjects = async (req, res) => {
  try {
    const { confirm } = req.query;
    if (confirm !== "DELETE_ALL") {
      return res.status(400).json({
        success: false,
        message:
          "Confirmation required. Provide ?confirm=DELETE_ALL in the query.",
      });
    }

    const result = await Project.deleteMany({});

    res.status(200).json({
      success: true,
      data: {
        deletedCount: result.deletedCount,
      },
      message: `Successfully deleted ${result.deletedCount} projects`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Failed to delete projects: ${error.message}`,
    });
  }
};

// Import projects from Excel
const importProjects = async (req, res) => {
  let tempFilePath = req.file?.path;
  console.log(req.file);
  console.log("req.file");

  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(tempFilePath);
    const worksheet = workbook.getWorksheet(1);
    const projects = [];

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      projects.push({
        code: row.getCell(1).value?.toString(),
        cmn: row.getCell(2).value?.toString(),
        refTSK: row.getCell(3).value?.toString(),
        qte: parseInt(row.getCell(4).value) || 0,
        pin: row.getCell(5).value?.toString(),
        sap1: row.getCell(6).value?.toString() || null,
        sap2: row.getCell(7).value?.toString() || null,
        refS: row.getCell(8).value?.toString(),
      });
    });

    const importedProjects = [];
    const errors = [];

    for (const proj of projects) {
      try {
        const existingProject = await Project.findOne({ code: proj.code });
        if (existingProject) {
          errors.push(`Project with code ${proj.code} already exists`);
          continue;
        }

        const project = new Project(proj);
        const savedProject = await project.save();
        importedProjects.push({
          code: savedProject.code,
          cmn: savedProject.cmn,
          refTSK: savedProject.refTSK,
        });
      } catch (err) {
        errors.push(`Error importing project ${proj.code}: ${err.message}`);
      }
    }

    await cleanupFile(tempFilePath);

    res.status(200).json({
      success: true,
      data: {
        imported: importedProjects.length,
        projects: importedProjects,
        errors: errors.length > 0 ? errors : undefined,
      },
      message: `Imported ${importedProjects.length} projects successfully`,
    });
  } catch (error) {
    if (tempFilePath) {
      await cleanupFile(tempFilePath);
    }
    res.status(500).json({
      success: false,
      message: `Failed to import projects: ${error.message}`,
    });
  }
};

module.exports = {
  createProject,
  getAllProjects,
  getProjectById,
  updateProject,
  deleteProject,
  deleteAllProjects,
  importProjects,
};

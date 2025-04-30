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
const getAllProjects = async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = "createdAt" } = req.query;
    const projects = await Project.find()
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort(sort);

    const total = await Project.countDocuments();

    res.status(200).json({
      success: true,
      data: projects,
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

// Get single project by ID
const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
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

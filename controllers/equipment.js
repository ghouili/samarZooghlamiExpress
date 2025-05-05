const { cleanupFile } = require("../middlewares/Fileuploader");
const ExcelJS = require("exceljs");
const Equipment = require("../models/equipment");
const Project = require("../models/project");
const { default: mongoose } = require("mongoose");

// Create a new equipment
const createEquipment = async (req, res) => {
  try {
    const equipmentData = {
      project: req.body.project,
      number: req.body.number,
      tableNumber: req.body.tableNumber,
      assetNumber: req.body.assetNumber,
      module: req.body.module,
      size: req.body.size,
      versionWin: req.body.versionWin,
      versionCswin: req.body.versionCswin,
      versionDongle: req.body.versionDongle,
      nomPc: req.body.nomPc,
    };

    // Check if project exists
    const projectExists = await Project.findById(project);
    if (!projectExists) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const equipment = new Equipment(equipmentData);
    const savedEquipment = await equipment.save();

    // Add equipment ID to project's equipments array
    projectExists.equipments.push(savedEquipment._id);
    await projectExists.save();

    res.status(201).json({
      success: true,
      data: savedEquipment,
      message: "Equipment created successfully",
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Asset number already exists",
      });
    }
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get all equipments
// const getAllEquipments = async (req, res) => {
//   try {
//     const { page, limit, sort = "createdAt", search } = req.query;
//     // const { page = 1, limit = 10, sort = "createdAt" } = req.query;
//     const equipments = await Equipment.find()
//       .limit(limit * 1)
//       .skip((page - 1) * limit)
//       .sort(sort)
//       .populate("project");

//     const total = await Equipment.countDocuments();

//     res.status(200).json({
//       success: true,
//       data: equipments,
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

const getAllEquipments = async (req, res) => {
  try {
    let { page, limit, sort = "createdAt", search } = req.query;

    // Parse page and limit with fallback values, ensuring valid integers
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;

    // Validate that pageNum and limitNum are positive integers
    if (isNaN(pageNum) || pageNum < 1) {
      throw new Error("Invalid page number");
    }
    if (isNaN(limitNum) || limitNum < 1) {
      throw new Error("Invalid limit value");
    }

    const searchRegex =
      search && search.trim() !== "" ? new RegExp(search, "i") : null;

    const pipeline = [
      {
        $lookup: {
          from: "projects",
          localField: "project",
          foreignField: "_id",
          as: "project",
        },
      },
      {
        $unwind: {
          path: "$project",
          preserveNullAndEmptyArrays: true, // Keep equipments without a project
        },
      },
    ];

    if (searchRegex) {
      pipeline.push({
        $match: {
          $or: [
            { tableNumber: searchRegex },
            { assetNumber: searchRegex },
            { module: searchRegex },
            { size: searchRegex },
            // Only include project.code if project exists
            {
              $and: [
                { "project.code": { $exists: true } },
                { "project.code": searchRegex },
              ],
            },
          ],
        },
      });
    }

    // Add sorting, skip, and limit for pagination
    pipeline.push({ $sort: { [sort]: 1 } });
    pipeline.push({ $skip: (pageNum - 1) * limitNum });
    pipeline.push({ $limit: limitNum });

    // Execute the main pipeline to fetch equipments
    const equipments = await Equipment.aggregate(pipeline);

    // Create a separate pipeline for total count (exclude skip and limit)
    const totalPipeline = [...pipeline.slice(0, -2)]; // Remove $skip and $limit
    const totalResult = await Equipment.aggregate([
      ...totalPipeline,
      { $count: "total" },
    ]);
    const total = totalResult.length > 0 ? totalResult[0].total : 0;

    res.status(200).json({
      success: true,
      data: equipments,
      total,
      pages: Math.ceil(total / limitNum),
      currentPage: pageNum,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Get single equipment by ID
const getEquipmentById = async (req, res) => {
  try {
    const equipment = await Equipment.findById(req.params.id).populate(
      "project"
    );
    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: "Equipment not found",
      });
    }
    res.status(200).json({
      success: true,
      data: equipment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Update equipment
const updateEquipment = async (req, res) => {
  try {
    const updates = {
      project: req.body.project,
      number: req.body.number,
      tableNumber: req.body.tableNumber,
      assetNumber: req.body.assetNumber,
      module: req.body.module,
      size: req.body.size,
      versionWin: req.body.versionWin,
      versionCswin: req.body.versionCswin,
      versionDongle: req.body.versionDongle,
      nomPc: req.body.nomPc,
    };

    Object.keys(updates).forEach(
      (key) => updates[key] === undefined && delete updates[key]
    );

    // Check if equipment exists
    const equipment = await Equipment.findById(req.params.id);
    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: "Equipment not found",
      });
    }

    // Validate project ID if provided
    let projectId = null;
    if (updates.project !== undefined) {
      if (
        updates.project &&
        !mongoose.Types.ObjectId.isValid(updates.project)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid project ID",
        });
      }
      if (updates.project) {
        const newProject = await Project.findById(updates.project);
        if (!newProject) {
          return res.status(404).json({
            success: false,
            message: "New project not found",
          });
        }
        projectId = updates.project;
      }
    }

    // If project is being updated, manage equipments array
    if (
      updates.project !== undefined &&
      updates.project !== (equipment.project?.toString() || null)
    ) {
      // Remove from old project's equipments if it exists
      if (equipment.project) {
        await Project.findByIdAndUpdate(equipment.project, {
          $pull: { equipments: equipment._id },
        });
      }

      // Add to new project's equipments if projectId exists
      if (projectId) {
        await Project.findByIdAndUpdate(projectId, {
          $push: { equipments: equipment._id },
        });
      }
    }

    const updatedEquipment = await Equipment.findByIdAndUpdate(
      req.params.id,
      { ...updates, updatedAt: Date.now() },
      { new: true, runValidators: true }
    ).populate("project", "code");

    res.status(200).json({
      success: true,
      data: updatedEquipment,
      message: "Equipment updated successfully",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete equipment
const deleteEquipment = async (req, res) => {
  try {
    const equipment = await Equipment.findById(req.params.id);
    if (!equipment) {
      return res.status(404).json({
        success: false,
        message: "Equipment not found",
      });
    }

    await Equipment.findByIdAndDelete(req.params.id);
    // Remove equipment ID from project's equipments array
    await Project.findByIdAndUpdate(equipment.project, {
      $pull: { equipments: equipment._id },
    });

    res.status(200).json({
      success: true,
      message: "Equipment deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Import equipments from Excel
const importEquipments = async (req, res) => {
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
    const equipments = [];

    // Fetch all projects to map codes to IDs
    const projects = await Project.find().select("code");
    const projectMap = new Map(projects.map((p) => [p.code, p._id]));

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      const projectCode = row.getCell(1).value?.toString();
      const projectId = projectMap.get(projectCode) || null; // Set to null if project code not found
      equipments.push({
        project: projectId,
        number: parseInt(row.getCell(2).value),
        tableNumber: row.getCell(3).value?.toString(),
        assetNumber: row.getCell(4).value?.toString(),
        module: row.getCell(5).value?.toString(),
        size: row.getCell(6).value?.toString(),
        versionWin: row.getCell(7).value?.toString(),
        versionCswin: row.getCell(8).value?.toString(),
        versionDongle: row.getCell(9).value?.toString(),
        nomPc: row.getCell(10).value?.toString(),
      });
    });

    const importedEquipments = [];
    const errors = [];

    for (const equip of equipments) {
      try {
        const existingEquipment = await Equipment.findOne({
          assetNumber: equip.assetNumber,
        });
        if (existingEquipment) {
          errors.push(
            `Equipment with asset number ${equip.assetNumber} already exists`
          );
          continue;
        }

        const equipment = new Equipment(equip);
        const savedEquipment = await equipment.save();

        // Add to project's equipments array if project exists
        if (equip.project) {
          await Project.findByIdAndUpdate(equip.project, {
            $push: { equipments: savedEquipment._id },
          });
        }

        importedEquipments.push({
          assetNumber: savedEquipment.assetNumber,
          project: savedEquipment.project,
          module: savedEquipment.module,
        });
      } catch (err) {
        errors.push(
          `Error importing equipment ${equip.assetNumber}: ${err.message}`
        );
      }
    }

    // Clean up temporary Excel file
    await cleanupFile(tempFilePath);

    res.status(200).json({
      success: true,
      data: {
        imported: importedEquipments.length,
        equipments: importedEquipments,
        errors: errors.length > 0 ? errors : undefined,
      },
      message: `Imported ${importedEquipments.length} equipments successfully`,
    });
  } catch (error) {
    if (tempFilePath) {
      await cleanupFile(tempFilePath);
    }
    res.status(500).json({
      success: false,
      message: `Failed to import equipments: ${error.message}`,
    });
  }
};

// Delete all equipments
const deleteAllEquipments = async (req, res) => {
  try {
    const { confirm } = req.query;

    if (confirm !== "DELETE_ALL") {
      return res.status(400).json({
        success: false,
        message:
          "Confirmation required. Provide ?confirm=DELETE_ALL in the query.",
      });
    }

    // Remove all equipment IDs from all projects
    await Project.updateMany({}, { $set: { equipments: [] } });

    const result = await Equipment.deleteMany({});

    res.status(200).json({
      success: true,
      data: {
        deletedCount: result.deletedCount,
      },
      message: `Successfully deleted ${result.deletedCount} equipments`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Failed to delete equipments: ${error.message}`,
    });
  }
};

module.exports = {
  createEquipment,
  getAllEquipments,
  getEquipmentById,
  updateEquipment,
  deleteEquipment,
  importEquipments,
  deleteAllEquipments,
};

const express = require("express");
const router = express.Router();
const { fileUploader } = require("../middlewares/Fileuploader");
// const { authMiddleware, adminMiddleware } = require("../middlewares/auth");
const projectController = require("../controllers/project");

router.post("/add", projectController.createProject);

// router.use(authMiddleware);
router.get("/:id", projectController.getProjectById);

// router.use(adminMiddleware);
router.get("/", projectController.getAllProjects);
// router.post("/", projectController.createProject);
router.put("/:id", projectController.updateProject);
router.delete("/one/:id", projectController.deleteProject);
router.delete("/all", projectController.deleteAllProjects);
router.post("/import", fileUploader.single('data'), projectController.importProjects);

module.exports = router;
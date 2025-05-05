const express = require("express");
const router = express.Router();

const { fileUploader } = require("../middlewares/Fileuploader");
// const { authMiddleware, adminMiddleware } = require("../middlewares/auth");
const equipmentController = require("../controllers/equipment");
// Public routes
router.post("/add", equipmentController.createEquipment);

// Protected routes (require authentication)
// router.use(authMiddleware);

// Equipment routes
router.get("/:id", equipmentController.getEquipmentById);
router.put("/:id", equipmentController.updateEquipment);

// Admin-only routes
// router.use(adminMiddleware);

router.get("/", equipmentController.getAllEquipments);
router.post("/", equipmentController.createEquipment);
router.post(
  "/import",
  fileUploader.single("data"),
  equipmentController.importEquipments
);
router.delete("/all", equipmentController.deleteAllEquipments);
router.delete("/one/:id", equipmentController.deleteEquipment);

module.exports = router;
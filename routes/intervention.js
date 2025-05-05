const express = require("express");
const router = express.Router();
const interventionController = require("../controllers/intervention");

router.post("/", interventionController.createIntervention);
router.get("/", interventionController.getAllInterventions);
router.get("/:id", interventionController.getInterventionById);
router.put("/:id", interventionController.updateIntervention);
router.delete("/one/:id", interventionController.deleteIntervention);
router.delete("/all", interventionController.deleteAllInterventions);

module.exports = router;

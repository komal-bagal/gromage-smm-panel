const express = require("express");
const {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  updateServiceStatus,
  updateServiceProviderMapping,
  bulkUpdateServicePrice,
} = require("../controllers/serviceController");
const {
  authenticate,
  authorizeAdmin,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authenticate, getServices);
router.patch("/bulk-price", authenticate, authorizeAdmin, bulkUpdateServicePrice);
router.get("/:serviceId", authenticate, getServiceById);
router.post("/", authenticate, authorizeAdmin, createService);
router.put("/:serviceId", authenticate, authorizeAdmin, updateService);
router.delete("/:serviceId", authenticate, authorizeAdmin, deleteService);
router.patch("/:serviceId/status", authenticate, authorizeAdmin, updateServiceStatus);
router.patch("/:serviceId/provider-mapping", authenticate, authorizeAdmin, updateServiceProviderMapping);

module.exports = router;

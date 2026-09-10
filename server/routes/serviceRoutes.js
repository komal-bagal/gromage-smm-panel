const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/roleMiddleware");

const {
  createService,
  getAllServices,
  getServiceById,
  updateService,
  deleteService,
  updateServiceStatus,
  bulkPriceUpdate
} = require("../controllers/serviceController");


// ======================================================
// SERVICE ROUTES
// ======================================================

// Get all services
router.get(
  "/",
  authMiddleware,
  getAllServices
);


// Get single service
router.get(
  "/:serviceId",
  authMiddleware,
  getServiceById
);


// Create service
router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  createService
);


// Update service
router.put(
  "/:serviceId",
  authMiddleware,
  adminMiddleware,
  updateService
);


// Delete service
router.delete(
  "/:serviceId",
  authMiddleware,
  adminMiddleware,
  deleteService
);


// Enable / Disable service
router.patch(
  "/:serviceId/status",
  authMiddleware,
  adminMiddleware,
  updateServiceStatus
);


// Bulk price update
router.patch(
  "/bulk-price",
  authMiddleware,
  adminMiddleware,
  bulkPriceUpdate
);


module.exports = router;
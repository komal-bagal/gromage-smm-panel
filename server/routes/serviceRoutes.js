const express = require("express");

const router = express.Router();

const authMiddleware =
  require("../middleware/authMiddleware");

const adminMiddleware =
  require("../middleware/roleMiddleware");

const {
  createService,
  getAllServices,
  getServiceById,
  updateService,
  deleteService,
  updateServiceStatus,
  bulkPriceUpdate,
  mapProviderService
} = require("../controllers/serviceController");


// ======================================================
// SERVICE ROUTES
// ======================================================


// ======================================================
// GET ALL SERVICES
// ======================================================

router.get(
  "/",
  authMiddleware,
  getAllServices
);


// ======================================================
// GET SINGLE SERVICE
// ======================================================

router.get(
  "/:serviceId",
  authMiddleware,
  getServiceById
);


// ======================================================
// CREATE SERVICE
// ======================================================

router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  createService
);


// ======================================================
// UPDATE SERVICE
// ======================================================

router.put(
  "/:serviceId",
  authMiddleware,
  adminMiddleware,
  updateService
);


// ======================================================
// DELETE SERVICE
// ======================================================

router.delete(
  "/:serviceId",
  authMiddleware,
  adminMiddleware,
  deleteService
);


// ======================================================
// ENABLE / DISABLE SERVICE
// ======================================================

router.patch(
  "/:serviceId/status",
  authMiddleware,
  adminMiddleware,
  updateServiceStatus
);


// ======================================================
// PROVIDER SERVICE MAPPING
// ======================================================

router.patch(
  "/:serviceId/provider-mapping",
  authMiddleware,
  adminMiddleware,
  mapProviderService
);


// ======================================================
// BULK PRICE UPDATE
// ======================================================

router.patch(
  "/bulk-price",
  authMiddleware,
  adminMiddleware,
  bulkPriceUpdate
);


module.exports = router;
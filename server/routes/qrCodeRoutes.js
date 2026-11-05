const express = require("express");

const qrController = require("../controllers/qrCodeController");

console.log("==============================================");
console.log("QR CONTROLLER LOADED:");
console.log(qrController);
console.log("QR CONTROLLER FILE:");
console.log(require.resolve("../controllers/qrCodeController"));
console.log("==============================================");

const {
  createQrCode,
  getAllQrCodes,
  getPublicQrCodes,
  getQrCodeById,
  updateQrCode,
  deleteQrCode
} = qrController;

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

// ======================================================
// PUBLIC QR ROUTE
// No authentication required
// ======================================================

router.get(
  "/public",
  getPublicQrCodes
);

// ======================================================
// ADMIN QR ROUTES
// Authentication + Admin role required
// ======================================================

router.post(
  "/",
  authMiddleware,
  roleMiddleware,
  createQrCode
);

router.get(
  "/",
  authMiddleware,
  roleMiddleware,
  getAllQrCodes
);

router.get(
  "/:id",
  authMiddleware,
  roleMiddleware,
  getQrCodeById
);

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware,
  updateQrCode
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware,
  deleteQrCode
);

module.exports = router;
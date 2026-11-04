const express = require("express");
const {
  getProviders,
  getProviderById,
  createProvider,
  updateProvider,
  deleteProvider,
  updateProviderStatus,
  updateProviderPriority,
  testProviderConnection,
  checkProviderBalance,
  syncProviderOrders,
  importSelectedServices,
} = require("../controllers/providerController");
const {
  authenticate,
  authorizeAdmin,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authenticate, getProviders);
router.post("/", authenticate, authorizeAdmin, createProvider);
router.get("/:providerId", authenticate, getProviderById);
router.put("/:providerId", authenticate, authorizeAdmin, updateProvider);
router.delete("/:providerId", authenticate, authorizeAdmin, deleteProvider);
router.patch("/:providerId/status", authenticate, authorizeAdmin, updateProviderStatus);
router.patch("/:providerId/priority", authenticate, authorizeAdmin, updateProviderPriority);
router.post("/:providerId/test-connection", authenticate, authorizeAdmin, testProviderConnection);
router.post("/:providerId/balance", authenticate, authorizeAdmin, checkProviderBalance);
router.post("/:providerId/sync", authenticate, authorizeAdmin, syncProviderOrders);
router.post("/:providerId/import-selected", authenticate, authorizeAdmin, importSelectedServices);

module.exports = router;

const express = require("express");

const {
  createSetting,
  getAllSettings,
  getPublicSettings,
  getSettingByKey,
  updateSetting,
  deleteSetting
} = require("../controllers/cmsSettingController");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

// ======================================================
// ADMIN ONLY
// ======================================================

// Create CMS setting
router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  createSetting
);

// Get all CMS settings
router.get(
  "/",
  authMiddleware,
  adminMiddleware,
  getAllSettings
);

// ======================================================
// PUBLIC
// ======================================================

// Get public CMS settings
// IMPORTANT: Keep this BEFORE /:key
router.get(
  "/public",
  getPublicSettings
);

// ======================================================
// ADMIN ONLY
// ======================================================

// Get setting by key
router.get(
  "/:key",
  authMiddleware,
  adminMiddleware,
  getSettingByKey
);

// Update setting by key
router.put(
  "/:key",
  authMiddleware,
  adminMiddleware,
  updateSetting
);

// Delete setting by key
router.delete(
  "/:key",
  authMiddleware,
  adminMiddleware,
  deleteSetting
);

module.exports = router;
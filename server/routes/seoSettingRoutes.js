const express = require("express");

const seoController =
  require("../controllers/seoSettingController");

const authMiddleware =
  require("../middleware/authMiddleware");

const adminMiddleware =
  require("../middleware/roleMiddleware");

console.log("========== SEO SETTING ROUTES LOADED ==========");
console.log(
  "createSeoSetting:",
  typeof seoController.createSeoSetting
);
console.log(
  "getAllSeoSettings:",
  typeof seoController.getAllSeoSettings
);
console.log(
  "getSeoSettingByPage:",
  typeof seoController.getSeoSettingByPage
);
console.log(
  "updateSeoSetting:",
  typeof seoController.updateSeoSetting
);
console.log(
  "deleteSeoSetting:",
  typeof seoController.deleteSeoSetting
);
console.log(
  "authMiddleware:",
  typeof authMiddleware
);
console.log(
  "adminMiddleware:",
  typeof adminMiddleware
);
console.log("================================================");

const router = express.Router();

// ======================================================
// ADMIN ONLY
// ======================================================

// Create SEO setting
router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  seoController.createSeoSetting
);

// Get all SEO settings
router.get(
  "/",
  authMiddleware,
  adminMiddleware,
  seoController.getAllSeoSettings
);

// ======================================================
// PUBLIC
// ======================================================

// Get SEO setting by page
// IMPORTANT: Keep this BEFORE /:id-style routes if applicable.
router.get(
  "/:page",
  seoController.getSeoSettingByPage
);

// ======================================================
// ADMIN ONLY
// ======================================================

// Update SEO setting
router.put(
  "/:id",
  authMiddleware,
  adminMiddleware,
  seoController.updateSeoSetting
);

// Delete SEO setting
router.delete(
  "/:id",
  authMiddleware,
  adminMiddleware,
  seoController.deleteSeoSetting
);

module.exports = router;
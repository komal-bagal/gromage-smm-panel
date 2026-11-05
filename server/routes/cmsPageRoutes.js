const express = require("express");

const {
  createPage,
  getAllPages,
  getPublicPage,
  getPageBySlug,
  updatePage,
  deletePage
} = require("../controllers/cmsPageController");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

// ======================================================
// PUBLIC PAGE
// ======================================================

// Get published/public page by slug
router.get("/public/:slug", getPublicPage);

// ======================================================
// ADMIN CMS PAGE MANAGEMENT
// ======================================================

// Create page
router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  createPage
);

// Get all pages
router.get(
  "/",
  authMiddleware,
  adminMiddleware,
  getAllPages
);

// Get page by slug
router.get(
  "/:slug",
  authMiddleware,
  adminMiddleware,
  getPageBySlug
);

// Update page
router.put(
  "/:slug",
  authMiddleware,
  adminMiddleware,
  updatePage
);

// Delete page
router.delete(
  "/:slug",
  authMiddleware,
  adminMiddleware,
  deletePage
);

module.exports = router;
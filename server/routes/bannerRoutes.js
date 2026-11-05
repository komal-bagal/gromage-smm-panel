const express = require("express");

const {
  createBanner,
  getAllBanners,
  getPublicBanners,
  getBannerById,
  updateBanner,
  deleteBanner
} = require("../controllers/bannerController");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

// ======================================================
// PUBLIC BANNERS
// ======================================================

router.get("/public", getPublicBanners);

// ======================================================
// ADMIN BANNER MANAGEMENT
// ======================================================

// Create banner
router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  createBanner
);

// Get all banners
router.get(
  "/",
  authMiddleware,
  adminMiddleware,
  getAllBanners
);

// Get banner by ID
router.get(
  "/:id",
  authMiddleware,
  adminMiddleware,
  getBannerById
);

// Update banner
router.put(
  "/:id",
  authMiddleware,
  adminMiddleware,
  updateBanner
);

// Delete banner
router.delete(
  "/:id",
  authMiddleware,
  adminMiddleware,
  deleteBanner
);

module.exports = router;
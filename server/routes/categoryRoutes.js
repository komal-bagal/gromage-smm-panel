const express = require("express");

const {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory
} = require("../controllers/categoryController");

const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

// ======================================================
// CATEGORY ROUTES
// ======================================================

// Create category
router.post(
  "/",
  authMiddleware,
  adminMiddleware,
  createCategory
);

// Get all categories
router.get(
  "/",
  authMiddleware,
  getAllCategories
);

// Get single category
router.get(
  "/:categoryId",
  authMiddleware,
  getCategoryById
);

// Update category
router.put(
  "/:categoryId",
  authMiddleware,
  adminMiddleware,
  updateCategory
);

// Delete category
router.delete(
  "/:categoryId",
  authMiddleware,
  adminMiddleware,
  deleteCategory
);

module.exports = router;
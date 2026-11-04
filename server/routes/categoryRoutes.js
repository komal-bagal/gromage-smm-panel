const express = require("express");
const {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");
const {
  authenticate,
  authorizeAdmin,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authenticate, getCategories);
router.get("/:categoryId", authenticate, getCategoryById);
router.post("/", authenticate, authorizeAdmin, createCategory);
router.put("/:categoryId", authenticate, authorizeAdmin, updateCategory);
router.delete("/:categoryId", authenticate, authorizeAdmin, deleteCategory);

module.exports = router;

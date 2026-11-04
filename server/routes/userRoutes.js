const express = require("express");
const {
  getAllUsers,
  getUserProfile,
  getUserById,
  updateUser,
  deleteUser,
  suspendUser,
  activateUser,
} = require("../controllers/userController");
const {
  authenticate,
  authorizeAdmin,
} = require("../middleware/authMiddleware");

const router = express.Router();

// User profile (any authenticated user)
router.get("/profile", authenticate, getUserProfile);

// Admin-only user management routes
router.get("/all", authenticate, authorizeAdmin, getAllUsers);
router.get("/:userId", authenticate, authorizeAdmin, getUserById);
router.put("/:userId", authenticate, authorizeAdmin, updateUser);
router.delete("/:userId", authenticate, authorizeAdmin, deleteUser);
router.put("/suspend/:userId", authenticate, authorizeAdmin, suspendUser);
router.put("/activate/:userId", authenticate, authorizeAdmin, activateUser);

module.exports = router;

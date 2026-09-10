const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const adminMiddleware = require("../middleware/roleMiddleware");

const {
  getProfile,
  getAllUsers,
  getUserById,
  updateUser,
  suspendUser,
  activateUser,
  deleteUser
} = require("../controllers/userController");


// ======================================================
// USER
// ======================================================

// Get logged-in user's profile

router.get(
  "/profile",
  authMiddleware,
  getProfile
);


// ======================================================
// ADMIN
// ======================================================

// Get all users

router.get(
  "/all",
  authMiddleware,
  adminMiddleware,
  getAllUsers
);


// Get single user

router.get(
  "/:userId",
  authMiddleware,
  adminMiddleware,
  getUserById
);


// Update user

router.put(
  "/:userId",
  authMiddleware,
  adminMiddleware,
  updateUser
);


// Suspend user

router.put(
  "/suspend/:userId",
  authMiddleware,
  adminMiddleware,
  suspendUser
);


// Activate user

router.put(
  "/activate/:userId",
  authMiddleware,
  adminMiddleware,
  activateUser
);


// Delete user

router.delete(
  "/:userId",
  authMiddleware,
  adminMiddleware,
  deleteUser
);


module.exports = router;
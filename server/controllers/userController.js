const mongoose = require("mongoose");
const User = require("../models/User");

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Get All Users Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users list",
    });
  }
};

const getUserProfile = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    console.error("Get User Profile Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user profile",
    });
  }
};

const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get User By ID Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user",
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const { name, email, status } = req.body;
    const updateData = {};

    if (name !== undefined) {
      updateData.name = String(name).trim();
    }

    if (email !== undefined) {
      updateData.email = String(email).trim().toLowerCase();
    }

    if (status !== undefined) {
      const s = String(status).toLowerCase();
      updateData.status = s === "suspended" ? "suspended" : "active";
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user: updated,
      message: "User updated successfully",
    });
  } catch (error) {
    console.error("Update User Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update user",
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const deleted = await User.findByIdAndDelete(userId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete User Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete user",
    });
  }
};

const suspendUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: { status: "suspended" } },
      { new: true }
    ).select("-password");

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user: updated,
      message: "User suspended successfully",
    });
  } catch (error) {
    console.error("Suspend User Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to suspend user",
    });
  }
};

const activateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: { status: "active" } },
      { new: true }
    ).select("-password");

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user: updated,
      message: "User activated successfully",
    });
  } catch (error) {
    console.error("Activate User Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to activate user",
    });
  }
};

module.exports = {
  getAllUsers,
  getUserProfile,
  getUserById,
  updateUser,
  deleteUser,
  suspendUser,
  activateUser,
};

const User = require("../models/User");
const AdminActivityLog = require("../models/AdminActivityLog");


// ======================================================
// GET LOGGED-IN USER PROFILE
// ======================================================

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select(
      "-password -resetPasswordToken -resetPasswordExpires"
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    return res.status(200).json({
      message: "Profile fetched successfully",

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        balance: user.balance,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error("GET PROFILE ERROR:", error);

    return res.status(500).json({
      message: "Server error"
    });
  }
};


// ======================================================
// GET ALL USERS
// ======================================================

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select(
      "-password -resetPasswordToken -resetPasswordExpires"
    );

    return res.status(200).json({
      message: "Users fetched successfully",
      count: users.length,
      users
    });

  } catch (error) {
    console.error("GET ALL USERS ERROR:", error);

    return res.status(500).json({
      message: "Server error"
    });
  }
};


// ======================================================
// GET SINGLE USER
// ======================================================

const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select(
      "-password -resetPasswordToken -resetPasswordExpires"
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    return res.status(200).json({
      message: "User fetched successfully",
      user
    });

  } catch (error) {
    console.error("GET USER BY ID ERROR:", error);

    return res.status(500).json({
      message: "Server error"
    });
  }
};


// ======================================================
// UPDATE USER
// ======================================================

const updateUser = async (req, res) => {
  try {
    const { name, email, status } = req.body || {};

    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // --------------------------------------------------
    // UPDATE NAME
    // --------------------------------------------------

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          message: "Name cannot be empty"
        });
      }

      user.name = name.trim();
    }

    // --------------------------------------------------
    // UPDATE EMAIL
    // --------------------------------------------------

    if (email !== undefined) {
      if (!email.trim()) {
        return res.status(400).json({
          message: "Email cannot be empty"
        });
      }

      user.email = email.toLowerCase().trim();
    }

    // --------------------------------------------------
    // UPDATE STATUS
    // --------------------------------------------------

    if (status !== undefined) {
      if (!["active", "suspended"].includes(status)) {
        return res.status(400).json({
          message: "Invalid status"
        });
      }

      user.status = status;
    }

    await user.save();

    // --------------------------------------------------
    // ACTIVITY LOG
    // --------------------------------------------------

    await AdminActivityLog.create({
      adminId: req.userId,
      action: "UPDATE_USER",
      targetUserId: user._id,
      description: `Admin updated user ${user.email}`,
      metadata: {
        name,
        email,
        status
      },
      status: "success"
    });

    // --------------------------------------------------
    // FETCH UPDATED USER
    // --------------------------------------------------

    const updatedUser = await User.findById(user._id).select(
      "-password -resetPasswordToken -resetPasswordExpires"
    );

    return res.status(200).json({
      message: "User updated successfully",
      user: updatedUser
    });

  } catch (error) {
    console.error("UPDATE USER ERROR:", error);

    // Duplicate email
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Email already exists"
      });
    }

    return res.status(500).json({
      message: "Server error"
    });
  }
};


// ======================================================
// SUSPEND USER
// ======================================================

const suspendUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      {
        status: "suspended"
      },
      {
        new: true
      }
    ).select(
      "-password -resetPasswordToken -resetPasswordExpires"
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // --------------------------------------------------
    // ACTIVITY LOG
    // --------------------------------------------------

    await AdminActivityLog.create({
      adminId: req.userId,
      action: "SUSPEND_USER",
      targetUserId: user._id,
      description: `Admin suspended user ${user.email}`,
      status: "success"
    });

    return res.status(200).json({
      message: "User suspended successfully",
      user
    });

  } catch (error) {
    console.error("SUSPEND USER ERROR:", error);

    return res.status(500).json({
      message: "Server error"
    });
  }
};


// ======================================================
// ACTIVATE USER
// ======================================================

const activateUser = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.userId,
      {
        status: "active"
      },
      {
        new: true
      }
    ).select(
      "-password -resetPasswordToken -resetPasswordExpires"
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // --------------------------------------------------
    // ACTIVITY LOG
    // --------------------------------------------------

    await AdminActivityLog.create({
      adminId: req.userId,
      action: "ACTIVATE_USER",
      targetUserId: user._id,
      description: `Admin activated user ${user.email}`,
      status: "success"
    });

    return res.status(200).json({
      message: "User activated successfully",
      user
    });

  } catch (error) {
    console.error("ACTIVATE USER ERROR:", error);

    return res.status(500).json({
      message: "Server error"
    });
  }
};


// ======================================================
// DELETE USER
// ======================================================

const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // --------------------------------------------------
    // PREVENT ADMIN FROM DELETING THEMSELVES
    // --------------------------------------------------

    if (user._id.toString() === req.userId.toString()) {
      return res.status(400).json({
        message: "Admin cannot delete own account"
      });
    }

    // --------------------------------------------------
    // DELETE USER
    // --------------------------------------------------

    await User.findByIdAndDelete(req.params.userId);

    // --------------------------------------------------
    // ACTIVITY LOG
    // --------------------------------------------------

    await AdminActivityLog.create({
      adminId: req.userId,
      action: "DELETE_USER",
      targetUserId: user._id,
      description: `Admin deleted user ${user.email}`,
      metadata: {
        deletedUserName: user.name,
        deletedUserEmail: user.email,
        deletedUserRole: user.role
      },
      status: "success"
    });

    return res.status(200).json({
      message: "User deleted successfully"
    });

  } catch (error) {
    console.error("DELETE USER ERROR:", error);

    return res.status(500).json({
      message: "Server error"
    });
  }
};


// ======================================================
// EXPORT
// ======================================================

module.exports = {
  getProfile,
  getAllUsers,
  getUserById,
  updateUser,
  suspendUser,
  activateUser,
  deleteUser
};
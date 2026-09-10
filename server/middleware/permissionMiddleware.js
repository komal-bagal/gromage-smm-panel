const Role = require("../models/Role");
const Permission = require("../models/Permission");

// ======================================================
// PERMISSION MIDDLEWARE
// ======================================================

const permissionMiddleware = (permissionName) => {
  return async (req, res, next) => {
    try {

      // --------------------------------------------------
      // CHECK AUTHENTICATION
      // --------------------------------------------------

      if (!req.user) {
        return res.status(401).json({
          message: "Authentication required"
        });
      }

      // --------------------------------------------------
      // VALIDATE PERMISSION NAME
      // --------------------------------------------------

      if (!permissionName) {
        return res.status(500).json({
          message: "Permission name is required"
        });
      }

      // --------------------------------------------------
      // FIND USER ROLE
      // --------------------------------------------------

      const role = await Role.findOne({
        name: req.user.role,
        status: "active"
      }).populate("permissions");

      // --------------------------------------------------
      // ROLE NOT FOUND
      // --------------------------------------------------

      if (!role) {
        return res.status(403).json({
          message: "Role not found"
        });
      }

      // --------------------------------------------------
      // CHECK PERMISSIONS
      // --------------------------------------------------

      const hasPermission = role.permissions.some(
        (permission) =>
          permission &&
          permission.name === permissionName &&
          permission.status === "active"
      );

      // --------------------------------------------------
      // PERMISSION DENIED
      // --------------------------------------------------

      if (!hasPermission) {
        return res.status(403).json({
          message: "Permission denied"
        });
      }

      // --------------------------------------------------
      // PERMISSION GRANTED
      // --------------------------------------------------

      next();

    } catch (error) {

      console.error(
        "PERMISSION MIDDLEWARE ERROR:",
        error
      );

      return res.status(500).json({
        message: "Server error",
        error: error.message
      });
    }
  };
};

module.exports = permissionMiddleware;
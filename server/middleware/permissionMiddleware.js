
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

      if (
        typeof permissionName !== "string" ||
        !permissionName.trim()
      ) {
        console.error(
          "PERMISSION MIDDLEWARE ERROR: Invalid permission name"
        );

        return res.status(500).json({
          message: "Server error"
        });
      }

      // --------------------------------------------------
      // FIND ACTIVE USER ROLE
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

      const permissions = Array.isArray(role.permissions)
        ? role.permissions
        : [];

      const hasPermission = permissions.some(
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

      return next();

    } catch (error) {
      // Log details on the server only.
      console.error(
        "PERMISSION MIDDLEWARE ERROR:",
        error
      );

      // Do not expose internal error details to the client.
      return res.status(500).json({
        message: "Server error"
      });
    }
  };
};

module.exports = permissionMiddleware;

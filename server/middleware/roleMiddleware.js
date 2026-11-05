
const adminMiddleware = (req, res, next) => {
  try {
    // Authentication check
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    // Account status check
    if (req.user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Account is suspended"
      });
    }

    // Admin role check
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required"
      });
    }

    return next();

  } catch (error) {
    console.error("ROLE MIDDLEWARE ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

module.exports = adminMiddleware;

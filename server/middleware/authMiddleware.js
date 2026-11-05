const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");

// ======================================================
// JWT CONFIGURATION
// ======================================================

const JWT_ISSUER = "gromage-smm-panel";
const JWT_AUDIENCE = "gromage-client";
const JWT_ALGORITHM = "HS256";

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET is missing or too weak");
  }

  return secret;
};

// ======================================================
// AUTH MIDDLEWARE
// ======================================================

const authMiddleware = async (req, res, next) => {
  try {
    // --------------------------------------------------
    // AUTHORIZATION HEADER
    // --------------------------------------------------

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "Authentication required"
      });
    }

    // Only accept: Authorization: Bearer <token>
    const parts = authHeader.trim().split(/\s+/);

    if (
      parts.length !== 2 ||
      parts[0].toLowerCase() !== "bearer" ||
      !parts[1]
    ) {
      return res.status(401).json({
        message: "Invalid authorization format"
      });
    }

    const token = parts[1];

    // --------------------------------------------------
    // JWT SECRET
    // --------------------------------------------------

    const jwtSecret = getJwtSecret();

    // --------------------------------------------------
    // VERIFY JWT
    // --------------------------------------------------

    const decoded = jwt.verify(token, jwtSecret, {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    });

    // --------------------------------------------------
    // VALIDATE USER ID
    // --------------------------------------------------

    if (
      !decoded ||
      !decoded.userId ||
      !mongoose.Types.ObjectId.isValid(decoded.userId)
    ) {
      return res.status(401).json({
        message: "Invalid token"
      });
    }

    // --------------------------------------------------
    // FIND USER
    // --------------------------------------------------

    const user = await User.findById(decoded.userId)
      .select("_id name email balance role status")
      .lean();

    if (!user) {
      return res.status(401).json({
        message: "Authentication failed"
      });
    }

    // --------------------------------------------------
    // ACCOUNT STATUS
    // Blocks only suspended accounts, consistent with
    // loginUser in authController.js
    // --------------------------------------------------

    if (user.status === "suspended") {
      return res.status(403).json({
        message: "Account is suspended"
      });
    }

    // --------------------------------------------------
    // ATTACH AUTHENTICATED USER
    // --------------------------------------------------

    req.user = user;
    req.userId = user._id;

    return next();

  } catch (error) {
    // JWT errors are intentionally not exposed.
    if (
      error.name === "TokenExpiredError" ||
      error.name === "JsonWebTokenError" ||
      error.name === "NotBeforeError"
    ) {
      return res.status(401).json({
        message: "Invalid or expired token"
      });
    }

    // Log server/configuration errors without exposing
    // secrets or token contents.
    console.error("AUTH MIDDLEWARE ERROR:", error.message);

    return res.status(500).json({
      message: "Authentication service error"
    });
  }
};

module.exports = authMiddleware;
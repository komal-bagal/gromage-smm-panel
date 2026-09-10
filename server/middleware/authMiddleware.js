const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "No token provided"
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        message: "Invalid token format"
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    console.log(
      "DECODED USER ID:",
      decoded.userId
    );

    const user = await User.findById(
      decoded.userId
    ).select("-password");

    if (!user) {
      console.log("AUTH USER NOT FOUND");

      return res.status(401).json({
        message: "User not found"
      });
    }

    if (user.status === "suspended") {
      return res.status(403).json({
        message: "Account is suspended"
      });
    }

    console.log(
      "AUTH USER ID:",
      user._id
    );

    console.log(
      "AUTH USER EMAIL:",
      user.email
    );

    console.log(
      "AUTH USER ROLE:",
      user.role
    );

    console.log(
      "AUTH USER STATUS:",
      user.status
    );

    req.user = user;

    req.userId = user._id;

    next();

  } catch (error) {
    console.error(
      "AUTH ERROR:",
      error.message
    );

    return res.status(401).json({
      message: "Invalid or expired token"
    });
  }
};

module.exports = authMiddleware;
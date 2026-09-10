
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");

// ======================================================
// REGISTER USER
// ======================================================

const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    console.log("REGISTER API CALLED");
    console.log("Email:", email);

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email and password are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters"
      });
    }

    const existingUser = await User.findOne({
      email: email.toLowerCase().trim()
    });

    if (existingUser) {
      return res.status(409).json({
        message: "User already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email: email.toLowerCase().trim(),
      password: hashedPassword
    });

    await user.save();

    console.log("User registered successfully");

    return res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        balance: user.balance,
        role: user.role,
        status: user.status
      }
    });

  } catch (error) {
    console.error("REGISTER ERROR:", error);

    return res.status(500).json({
      message: "Server error"
    });
  }
};


// ======================================================
// LOGIN USER
// ======================================================

const loginUser = async (req, res) => {
  try {
    console.log("1. Login API called");

    const { email, password } = req.body;

    console.log("2. Email received:", email);

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required"
      });
    }

    console.log("3. Searching user...");

    const user = await User.findOne({
      email: email.toLowerCase().trim()
    });

    console.log(
      "4. User found:",
      user ? "YES" : "NO"
    );

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    console.log("5. Checking password...");

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    console.log(
      "6. Password correct:",
      isPasswordCorrect
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    // Check account status
    if (user.status === "suspended") {
      return res.status(403).json({
        message: "Account is suspended"
      });
    }

    console.log("7. Creating JWT...");

    console.log(
      "JWT_SECRET exists:",
      !!process.env.JWT_SECRET
    );

    const token = jwt.sign(
      {
        userId: user._id
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d"
      }
    );

    console.log("8. JWT created successfully");

    return res.status(200).json({
      message: "Login successful",

      token: token,

      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        balance: user.balance,
        role: user.role,
        status: user.status
      }
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      message: "Server error"
    });
  }
};


// ======================================================
// LOGOUT USER
// ======================================================

const logoutUser = async (req, res) => {
  try {
    return res.status(200).json({
      message: "Logout successful"
    });

  } catch (error) {
    console.error("LOGOUT ERROR:", error);

    return res.status(500).json({
      message: "Server error"
    });
  }
};


// ======================================================
// FORGOT PASSWORD
// ======================================================

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    console.log("FORGOT PASSWORD API CALLED");
    console.log("Email:", email);

    if (!email) {
      return res.status(400).json({
        message: "Email is required"
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim()
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // Generate secure random reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Token expires after 15 minutes
    const resetTokenExpiry = new Date(
      Date.now() + 15 * 60 * 1000
    );

    // Save token and expiry
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiry;

    await user.save();

    console.log(
      "Password reset token generated successfully"
    );

    return res.status(200).json({
      message: "Password reset token generated successfully",
      resetToken: resetToken,
      expiresAt: resetTokenExpiry
    });

  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);

    return res.status(500).json({
      message: "Server error"
    });
  }
};


// ======================================================
// RESET PASSWORD
// ======================================================

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    console.log("RESET PASSWORD API CALLED");

    if (!token || !newPassword) {
      return res.status(400).json({
        message: "Token and new password are required"
      });
    }

    // Minimum password length
    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters"
      });
    }

    console.log("Searching reset token...");

    // Find user with valid token
    // and check that token is not expired
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: {
        $gt: new Date()
      }
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired reset token"
      });
    }

    console.log("Valid reset token found");

    // Hash new password
    const hashedPassword = await bcrypt.hash(
      newPassword,
      10
    );

    // Update password
    user.password = hashedPassword;

    // Remove reset token after successful reset
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await user.save();

    console.log("Password reset successfully");

    return res.status(200).json({
      message: "Password reset successfully"
    });

  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);

    return res.status(500).json({
      message: "Server error"
    });
  }
};


// ======================================================
// EXPORT
// ======================================================

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  forgotPassword,
  resetPassword
};


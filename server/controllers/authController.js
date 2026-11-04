const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered. Please sign in with your password, sign in with Google, or reset your password.",
        isRegistered: true,
        hasPassword: existingUser.hasPassword !== false,
        authProvider: existingUser.authProvider || "local",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      authProvider: "local",
      hasPassword: true,
      role: "user",
      status: "active",
    });

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        balance: user.balance,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Register Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error during registration",
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (user.status === "suspended" || user.status === "inactive") {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated or suspended. Please contact support.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // If user was created via Google and hasn't configured a password yet
      if (user.hasPassword === false || user.authProvider === "google") {
        return res.status(401).json({
          success: false,
          message: "This account was created with Google Sign-In and does not have a password configured yet. Please sign in with Google or use 'Forgot Password' to set one.",
          hasPassword: false,
          authProvider: "google",
        });
      }

      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const jwtSecret = process.env.JWT_SECRET || "gromage_smm_panel_jwt_secret_key_2026";
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
      },
      jwtSecret,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        balance: user.balance,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error during login",
    });
  }
};

const googleAuth = async (req, res) => {
  try {
    const { credential, accessToken } = req.body;

    if (!credential && !accessToken) {
      return res.status(400).json({
        success: false,
        message: "Google credential or access token is required",
      });
    }

    let googleEmail = null;
    let googleName = null;
    let emailVerified = true;

    if (credential) {
      const googleRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
      );

      if (!googleRes.ok) {
        return res.status(401).json({
          success: false,
          message: "Invalid or expired Google credential",
        });
      }

      const payload = await googleRes.json();
      const expectedClientId = process.env.GOOGLE_CLIENT_ID;
      if (expectedClientId && payload.aud !== expectedClientId) {
        return res.status(401).json({
          success: false,
          message: "Google token audience mismatch",
        });
      }

      if (payload.email_verified !== undefined) {
        emailVerified = payload.email_verified === true || payload.email_verified === "true";
      }

      googleEmail = payload.email;
      googleName = payload.name || payload.given_name || (payload.email ? payload.email.split("@")[0] : "Customer");
    } else if (accessToken) {
      const expectedClientId = process.env.GOOGLE_CLIENT_ID;
      if (expectedClientId) {
        const tokenInfoRes = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
        );
        if (!tokenInfoRes.ok) {
          return res.status(401).json({
            success: false,
            message: "Invalid or expired Google access token",
          });
        }
        const tokenInfo = await tokenInfoRes.json();
        const tokenAud = tokenInfo.aud || tokenInfo.azp;
        if (tokenAud && tokenAud !== expectedClientId) {
          return res.status(401).json({
            success: false,
            message: "Google token audience mismatch",
          });
        }
      }

      const googleRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!googleRes.ok) {
        return res.status(401).json({
          success: false,
          message: "Invalid or expired Google access token",
        });
      }

      const payload = await googleRes.json();
      if (payload.email_verified !== undefined) {
        emailVerified = payload.email_verified === true || payload.email_verified === "true";
      }

      googleEmail = payload.email;
      googleName = payload.name || payload.given_name || (payload.email ? payload.email.split("@")[0] : "Customer");
    }

    if (!googleEmail) {
      return res.status(400).json({
        success: false,
        message: "Unable to retrieve verified email from Google account",
      });
    }

    if (!emailVerified) {
      return res.status(403).json({
        success: false,
        message: "Google account email is not verified by Google. Please verify your email first.",
      });
    }

    const normalizedEmail = googleEmail.toLowerCase().trim();

    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = await User.create({
        name: googleName.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        authProvider: "google",
        hasPassword: false,
        role: "user",
        status: "active",
      });
    } else {
      if (user.status === "suspended" || user.status === "inactive") {
        return res.status(403).json({
          success: false,
          message: "Your account has been deactivated or suspended. Please contact support.",
        });
      }
    }

    if (user.role !== "user") {
      return res.status(403).json({
        success: false,
        message: "Google Sign-In is restricted to customer accounts only. Staff must use their dedicated admin credentials.",
      });
    }

    const jwtSecret = process.env.JWT_SECRET || "gromage_smm_panel_jwt_secret_key_2026";
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
      },
      jwtSecret,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      success: true,
      message: "Google authentication successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        balance: user.balance,
        role: user.role,
        authProvider: user.authProvider || "google",
        hasPassword: user.hasPassword !== false,
      },
    });
  } catch (error) {
    console.error("Google Auth Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during Google authentication",
    });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Email address is required",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email address. Please register or check your email spelling.",
      });
    }

    if (user.status === "suspended" || user.status === "inactive") {
      return res.status(403).json({
        success: false,
        message: "This account has been deactivated or suspended. Please contact support.",
      });
    }

    // Generate secure 32-byte reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Store SHA256 hashed token in MongoDB
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour validity
    await user.save();

    // Derive base application URL from request headers or env
    const clientOrigin = (req.headers.origin || process.env.CLIENT_URL || "http://localhost:5175").replace(/\/+$/, "");
    const resetUrl = `${clientOrigin}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

    console.log(`[PASSWORD RESET GENERATED for ${user.email}]: ${resetUrl}`);

    return res.status(200).json({
      success: true,
      message: user.hasPassword === false
        ? "Password setup link generated successfully. Please use the link below to set your account password."
        : "Password reset link generated successfully. Please use the link below to reset your password.",
      resetUrl,
      resetToken,
      email: user.email,
      hasPassword: user.hasPassword !== false,
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while processing password reset request",
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword, email } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Password reset token is required",
      });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters",
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const query = {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    };

    if (email) {
      query.email = email.toLowerCase().trim();
    }

    const user = await User.findOne(query);

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired password reset link. Please request a new link.",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.hasPassword = true;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password configured successfully! You can now log in using your email and password.",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while resetting password",
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  googleAuth,
  forgotPassword,
  resetPassword,
};

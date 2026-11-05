const Branding = require("../models/Branding");

// ======================================================
// CREATE BRANDING
// ======================================================

const createBranding = async (req, res) => {
  try {
    console.log("========== CREATE BRANDING DEBUG ==========");
    console.log("REQ BODY:", req.body);
    console.log("REQ USER:", req.user);
    console.log("============================================");

    const existingBranding = await Branding.findOne();

    if (existingBranding) {
      return res.status(400).json({
        success: false,
        message: "Branding settings already exist"
      });
    }

    const branding = await Branding.create({
      ...req.body,
      updatedBy: req.user?._id || null
    });

    res.status(201).json({
      success: true,
      message: "Branding settings created successfully",
      data: branding
    });
  } catch (error) {
    console.error("CREATE BRANDING ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ======================================================
// GET BRANDING
// ======================================================

const getBranding = async (req, res) => {
  try {
    const branding = await Branding.findOne();

    if (!branding) {
      return res.status(404).json({
        success: false,
        message: "Branding settings not found"
      });
    }

    res.status(200).json({
      success: true,
      data: branding
    });
  } catch (error) {
    console.error("GET BRANDING ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ======================================================
// UPDATE BRANDING
// ======================================================

const updateBranding = async (req, res) => {
  try {
    const branding = await Branding.findOne();

    if (!branding) {
      return res.status(404).json({
        success: false,
        message: "Branding settings not found"
      });
    }

    const updatedBranding =
      await Branding.findByIdAndUpdate(
        branding._id,
        {
          ...req.body,
          updatedBy:
            req.user?._id ||
            branding.updatedBy
        },
        {
          new: true,
          runValidators: true
        }
      );

    res.status(200).json({
      success: true,
      message:
        "Branding settings updated successfully",
      data: updatedBranding
    });
  } catch (error) {
    console.error(
      "UPDATE BRANDING ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ======================================================
// DELETE BRANDING
// ======================================================

const deleteBranding = async (req, res) => {
  try {
    const branding = await Branding.findOne();

    if (!branding) {
      return res.status(404).json({
        success: false,
        message:
          "Branding settings not found"
      });
    }

    await Branding.findByIdAndDelete(
      branding._id
    );

    res.status(200).json({
      success: true,
      message:
        "Branding settings deleted successfully"
    });
  } catch (error) {
    console.error(
      "DELETE BRANDING ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        error.message
    });
  }
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  createBranding,
  getBranding,
  updateBranding,
  deleteBranding
};
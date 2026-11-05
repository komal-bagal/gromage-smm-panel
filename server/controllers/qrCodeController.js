console.log("========== QR CODE CONTROLLER FILE LOADED ==========");

const QrCode = require("../models/QrCode");

// Create QR Code
const createQrCode = async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      qrData,
      imageUrl,
      sortOrder,
      isPublic,
      isActive
    } = req.body;

    if (!name || !code || !qrData) {
      return res.status(400).json({
        success: false,
        message: "name, code and qrData are required"
      });
    }

    const normalizedCode = code.toLowerCase().trim();

    const existingQrCode = await QrCode.findOne({
      code: normalizedCode
    });

    if (existingQrCode) {
      return res.status(409).json({
        success: false,
        message: "QR code with this code already exists"
      });
    }

    const qrCode = await QrCode.create({
      name,
      code: normalizedCode,
      description,
      qrData,
      imageUrl,
      sortOrder,
      isPublic,
      isActive,
      updatedBy: req.user?._id || req.user?.id || null
    });

    return res.status(201).json({
      success: true,
      message: "QR code created successfully",
      data: qrCode
    });
  } catch (error) {
    console.error("CREATE QR CODE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create QR code",
      error: error.message
    });
  }
};

// Get All QR Codes
const getAllQrCodes = async (req, res) => {
  try {
    const qrCodes = await QrCode.find()
      .sort({ sortOrder: 1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: qrCodes.length,
      data: qrCodes
    });
  } catch (error) {
    console.error("GET ALL QR CODES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch QR codes",
      error: error.message
    });
  }
};

// Get Public QR Codes
const getPublicQrCodes = async (req, res) => {
  try {
    const qrCodes = await QrCode.find({
      isPublic: true,
      isActive: true
    }).sort({
      sortOrder: 1,
      createdAt: -1
    });

    return res.status(200).json({
      success: true,
      count: qrCodes.length,
      data: qrCodes
    });
  } catch (error) {
    console.error("GET PUBLIC QR CODES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch QR codes",
      error: error.message
    });
  }
};

// Get QR Code By ID
const getQrCodeById = async (req, res) => {
  try {
    const qrCode = await QrCode.findById(req.params.id);

    if (!qrCode) {
      return res.status(404).json({
        success: false,
        message: "QR code not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: qrCode
    });
  } catch (error) {
    console.error("GET QR CODE BY ID ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch QR code",
      error: error.message
    });
  }
};

// Update QR Code
const updateQrCode = async (req, res) => {
  try {
    const updates = { ...req.body };

    if (updates.code) {
      updates.code = updates.code.toLowerCase().trim();

      const existingQrCode = await QrCode.findOne({
        code: updates.code,
        _id: { $ne: req.params.id }
      });

      if (existingQrCode) {
        return res.status(409).json({
          success: false,
          message: "QR code with this code already exists"
        });
      }
    }

    updates.updatedBy = req.user?._id || req.user?.id || null;

    const qrCode = await QrCode.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        new: true,
        runValidators: true
      }
    );

    if (!qrCode) {
      return res.status(404).json({
        success: false,
        message: "QR code not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "QR code updated successfully",
      data: qrCode
    });
  } catch (error) {
    console.error("UPDATE QR CODE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update QR code",
      error: error.message
    });
  }
};

// Delete QR Code
const deleteQrCode = async (req, res) => {
  try {
    const qrCode = await QrCode.findByIdAndDelete(req.params.id);

    if (!qrCode) {
      return res.status(404).json({
        success: false,
        message: "QR code not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "QR code deleted successfully"
    });
  } catch (error) {
    console.error("DELETE QR CODE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete QR code",
      error: error.message
    });
  }
};

module.exports = {
  createQrCode,
  getAllQrCodes,
  getPublicQrCodes,
  getQrCodeById,
  updateQrCode,
  deleteQrCode
};

console.log("========== QR CODE CONTROLLER EXPORTS ==========");
console.log(module.exports);
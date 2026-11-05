const CmsSetting = require("../models/CmsSetting");

// ======================================================
// CONSTANTS
// ======================================================

const MAX_LIMIT = 100;

const allowedTypes = [
  "text",
  "number",
  "boolean",
  "json",
  "image",
  "url"
];

const allowedCategories = [
  "general",
  "branding",
  "payment",
  "seo",
  "social",
  "notification",
  "security",
  "other"
];


// ======================================================
// HELPERS
// ======================================================

const isValidBoolean = (value) => {
  return typeof value === "boolean";
};

const isValidKey = (key) => {
  return (
    typeof key === "string" &&
    key.trim().length > 0 &&
    key.trim().length <= 100
  );
};

const normalizeKey = (key) => {
  return key.trim();
};


// ======================================================
// CREATE SETTING
// ======================================================

const createSetting = async (req, res) => {
  try {
    const {
      key,
      value,
      type,
      category,
      description,
      isPublic,
      isActive
    } = req.body;

    // --------------------------------------------------
    // KEY VALIDATION
    // --------------------------------------------------

    if (!isValidKey(key)) {
      return res.status(400).json({
        success: false,
        message:
          "Setting key is required and must be a string up to 100 characters"
      });
    }

    const normalizedKey = normalizeKey(key);

    // --------------------------------------------------
    // TYPE VALIDATION
    // --------------------------------------------------

    if (
      type !== undefined &&
      !allowedTypes.includes(type)
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Invalid setting type. Allowed types: ${allowedTypes.join(", ")}`
      });
    }

    // --------------------------------------------------
    // CATEGORY VALIDATION
    // --------------------------------------------------

    if (
      category !== undefined &&
      !allowedCategories.includes(category)
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Invalid setting category. Allowed categories: ${allowedCategories.join(", ")}`
      });
    }

    // --------------------------------------------------
    // BOOLEAN VALIDATION
    // --------------------------------------------------

    if (
      isPublic !== undefined &&
      !isValidBoolean(isPublic)
    ) {
      return res.status(400).json({
        success: false,
        message: "isPublic must be a boolean"
      });
    }

    if (
      isActive !== undefined &&
      !isValidBoolean(isActive)
    ) {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean"
      });
    }

    // --------------------------------------------------
    // DESCRIPTION VALIDATION
    // --------------------------------------------------

    if (
      description !== undefined &&
      (
        typeof description !== "string" ||
        description.length > 500
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Description must be a string up to 500 characters"
      });
    }

    // --------------------------------------------------
    // CHECK DUPLICATE
    // --------------------------------------------------

    const existingSetting =
      await CmsSetting.findOne({
        key: normalizedKey
      });

    if (existingSetting) {
      return res.status(409).json({
        success: false,
        message:
          "Setting with this key already exists"
      });
    }

    // --------------------------------------------------
    // CREATE SETTING
    // --------------------------------------------------

    const setting =
      await CmsSetting.create({
        key: normalizedKey,
        value,
        type,
        category,
        description,
        isPublic,
        isActive,
        updatedBy: req.userId
      });

    return res.status(201).json({
      success: true,
      message:
        "CMS setting created successfully",
      data: setting
    });

  } catch (error) {
    console.error(
      "CREATE CMS SETTING ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to create CMS setting"
    });
  }
};


// ======================================================
// GET ALL SETTINGS
// ======================================================

const getAllSettings = async (req, res) => {
  try {
    const {
      category,
      type,
      isActive,
      page = 1,
      limit = 20
    } = req.query;

    // --------------------------------------------------
    // PAGINATION VALIDATION
    // --------------------------------------------------

    const pageNumber =
      Number(page);

    const limitNumber =
      Number(limit);

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1
    ) {
      return res.status(400).json({
        success: false,
        message:
          "page must be a positive integer"
      });
    }

    if (
      !Number.isInteger(limitNumber) ||
      limitNumber < 1 ||
      limitNumber > MAX_LIMIT
    ) {
      return res.status(400).json({
        success: false,
        message:
          `limit must be between 1 and ${MAX_LIMIT}`
      });
    }

    // --------------------------------------------------
    // FILTER
    // --------------------------------------------------

    const filter = {};

    // --------------------------------------------------
    // CATEGORY FILTER
    // --------------------------------------------------

    if (category) {
      if (
        !allowedCategories.includes(category)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid setting category"
        });
      }

      filter.category = category;
    }

    // --------------------------------------------------
    // TYPE FILTER
    // --------------------------------------------------

    if (type) {
      if (
        !allowedTypes.includes(type)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid setting type"
        });
      }

      filter.type = type;
    }

    // --------------------------------------------------
    // ACTIVE FILTER
    // --------------------------------------------------

    if (isActive !== undefined) {
      if (
        isActive !== "true" &&
        isActive !== "false"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "isActive must be true or false"
        });
      }

      filter.isActive =
        isActive === "true";
    }

    // --------------------------------------------------
    // PAGINATION
    // --------------------------------------------------

    const skip =
      (pageNumber - 1) *
      limitNumber;

    // --------------------------------------------------
    // DATABASE QUERY
    // --------------------------------------------------

    const [
      settings,
      total
    ] = await Promise.all([
      CmsSetting.find(filter)
        .sort({
          createdAt: -1
        })
        .skip(skip)
        .limit(limitNumber)
        .populate(
          "updatedBy",
          "name email"
        )
        .lean(),

      CmsSetting.countDocuments(filter)
    ]);

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      success: true,

      data: settings,

      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages:
          Math.ceil(
            total / limitNumber
          )
      }
    });

  } catch (error) {
    console.error(
      "GET CMS SETTINGS ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get CMS settings"
    });
  }
};


// ======================================================
// GET PUBLIC SETTINGS
// ======================================================

const getPublicSettings = async (
  req,
  res
) => {
  try {
    const settings =
      await CmsSetting.find({
        isPublic: true,
        isActive: true
      })
        .select(
          "key value type category description -_id"
        )
        .lean();

    return res.status(200).json({
      success: true,
      data: settings
    });

  } catch (error) {
    console.error(
      "GET PUBLIC CMS SETTINGS ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get public settings"
    });
  }
};


// ======================================================
// GET SETTING BY KEY
// ======================================================

const getSettingByKey = async (
  req,
  res
) => {
  try {
    const { key } =
      req.params;

    // --------------------------------------------------
    // KEY VALIDATION
    // --------------------------------------------------

    if (!isValidKey(key)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid setting key"
      });
    }

    // --------------------------------------------------
    // FIND SETTING
    // --------------------------------------------------

    const setting =
      await CmsSetting.findOne({
        key: normalizeKey(key)
      }).lean();

    if (!setting) {
      return res.status(404).json({
        success: false,
        message:
          "CMS setting not found"
      });
    }

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      success: true,
      data: setting
    });

  } catch (error) {
    console.error(
      "GET CMS SETTING ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get CMS setting"
    });
  }
};


// ======================================================
// UPDATE SETTING
// ======================================================

const updateSetting = async (
  req,
  res
) => {
  try {
    const { key } =
      req.params;

    const {
      value,
      type,
      category,
      description,
      isPublic,
      isActive
    } = req.body;

    // --------------------------------------------------
    // KEY VALIDATION
    // --------------------------------------------------

    if (!isValidKey(key)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid setting key"
      });
    }

    // --------------------------------------------------
    // TYPE VALIDATION
    // --------------------------------------------------

    if (
      type !== undefined &&
      !allowedTypes.includes(type)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid setting type"
      });
    }

    // --------------------------------------------------
    // CATEGORY VALIDATION
    // --------------------------------------------------

    if (
      category !== undefined &&
      !allowedCategories.includes(category)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid setting category"
      });
    }

    // --------------------------------------------------
    // BOOLEAN VALIDATION
    // --------------------------------------------------

    if (
      isPublic !== undefined &&
      !isValidBoolean(isPublic)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "isPublic must be a boolean"
      });
    }

    if (
      isActive !== undefined &&
      !isValidBoolean(isActive)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "isActive must be a boolean"
      });
    }

    // --------------------------------------------------
    // DESCRIPTION VALIDATION
    // --------------------------------------------------

    if (
      description !== undefined &&
      (
        typeof description !== "string" ||
        description.length > 500
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Description must be a string up to 500 characters"
      });
    }

    // --------------------------------------------------
    // FIND SETTING
    // --------------------------------------------------

    const setting =
      await CmsSetting.findOne({
        key: normalizeKey(key)
      });

    if (!setting) {
      return res.status(404).json({
        success: false,
        message:
          "CMS setting not found"
      });
    }

    // --------------------------------------------------
    // UPDATE VALUES
    // --------------------------------------------------

    if (value !== undefined) {
      setting.value = value;
    }

    if (type !== undefined) {
      setting.type = type;
    }

    if (category !== undefined) {
      setting.category = category;
    }

    if (description !== undefined) {
      setting.description =
        description;
    }

    if (isPublic !== undefined) {
      setting.isPublic =
        isPublic;
    }

    if (isActive !== undefined) {
      setting.isActive =
        isActive;
    }

    // --------------------------------------------------
    // UPDATED BY
    // --------------------------------------------------

    setting.updatedBy =
      req.userId;

    // --------------------------------------------------
    // SAVE
    // --------------------------------------------------

    await setting.save();

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      success: true,
      message:
        "CMS setting updated successfully",
      data: setting
    });

  } catch (error) {
    console.error(
      "UPDATE CMS SETTING ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to update CMS setting"
    });
  }
};


// ======================================================
// DELETE SETTING
// ======================================================

const deleteSetting = async (
  req,
  res
) => {
  try {
    const { key } =
      req.params;

    // --------------------------------------------------
    // KEY VALIDATION
    // --------------------------------------------------

    if (!isValidKey(key)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid setting key"
      });
    }

    // --------------------------------------------------
    // DELETE
    // --------------------------------------------------

    const setting =
      await CmsSetting.findOneAndDelete({
        key: normalizeKey(key)
      });

    if (!setting) {
      return res.status(404).json({
        success: false,
        message:
          "CMS setting not found"
      });
    }

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      success: true,
      message:
        "CMS setting deleted successfully"
    });

  } catch (error) {
    console.error(
      "DELETE CMS SETTING ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete CMS setting"
    });
  }
};


// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  createSetting,
  getAllSettings,
  getPublicSettings,
  getSettingByKey,
  updateSetting,
  deleteSetting
};
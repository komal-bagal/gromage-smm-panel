const SeoSetting = require("../models/SeoSetting");

// ======================================================
// CONSTANTS
// ======================================================

const MAX_PAGE_LENGTH = 100;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_KEYWORDS_LENGTH = 500;
const MAX_URL_LENGTH = 2048;
const MAX_ROBOTS_LENGTH = 100;


// ======================================================
// HELPERS
// ======================================================

const isValidRequiredString = (value, maxLength) => {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
};

const isValidOptionalString = (value, maxLength) => {
  return (
    value === undefined ||
    value === null ||
    (
      typeof value === "string" &&
      value.length <= maxLength
    )
  );
};

const normalizeString = (value) => {
  return value.trim();
};


// ======================================================
// CREATE SEO SETTING
// ======================================================

const createSeoSetting = async (req, res) => {
  try {
    const {
      page,
      title,
      description,
      keywords,
      canonicalUrl,
      ogTitle,
      ogDescription,
      ogImage,
      robots
    } = req.body;

    // --------------------------------------------------
    // REQUIRED FIELD VALIDATION
    // --------------------------------------------------

    if (
      !isValidRequiredString(
        page,
        MAX_PAGE_LENGTH
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Page is required and must be a valid string"
      });
    }

    if (
      !isValidRequiredString(
        title,
        MAX_TITLE_LENGTH
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Title is required and must be a valid string"
      });
    }

    // --------------------------------------------------
    // OPTIONAL FIELD VALIDATION
    // --------------------------------------------------

    if (
      !isValidOptionalString(
        description,
        MAX_DESCRIPTION_LENGTH
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Description must be a valid string"
      });
    }

    if (
      !isValidOptionalString(
        keywords,
        MAX_KEYWORDS_LENGTH
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Keywords must be a valid string"
      });
    }

    if (
      !isValidOptionalString(
        canonicalUrl,
        MAX_URL_LENGTH
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Canonical URL must be a valid string"
      });
    }

    if (
      !isValidOptionalString(
        ogTitle,
        MAX_TITLE_LENGTH
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "OG title must be a valid string"
      });
    }

    if (
      !isValidOptionalString(
        ogDescription,
        MAX_DESCRIPTION_LENGTH
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "OG description must be a valid string"
      });
    }

    if (
      !isValidOptionalString(
        ogImage,
        MAX_URL_LENGTH
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "OG image URL must be a valid string"
      });
    }

    if (
      !isValidOptionalString(
        robots,
        MAX_ROBOTS_LENGTH
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Robots value must be a valid string"
      });
    }

    // --------------------------------------------------
    // NORMALIZE
    // --------------------------------------------------

    const normalizedPage =
      normalizeString(page);

    const normalizedTitle =
      normalizeString(title);

    // --------------------------------------------------
    // DUPLICATE CHECK
    // --------------------------------------------------

    const existingSeo =
      await SeoSetting.findOne({
        page: normalizedPage
      });

    if (existingSeo) {
      return res.status(409).json({
        success: false,
        message:
          "SEO setting for this page already exists"
      });
    }

    // --------------------------------------------------
    // CREATE
    // --------------------------------------------------

    const seoSetting =
      await SeoSetting.create({
        page: normalizedPage,
        title: normalizedTitle,
        description,
        keywords,
        canonicalUrl,
        ogTitle,
        ogDescription,
        ogImage,
        robots,
        updatedBy:
          req.userId || null
      });

    return res.status(201).json({
      success: true,
      message:
        "SEO setting created successfully",
      data: seoSetting
    });

  } catch (error) {
    console.error(
      "CREATE SEO SETTING ERROR:",
      error.message
    );

    // Handle MongoDB duplicate key race condition
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "SEO setting for this page already exists"
      });
    }

    // Handle Mongoose validation error
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message:
          "Invalid SEO setting data"
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to create SEO setting"
    });
  }
};


// ======================================================
// GET ALL SEO SETTINGS
// ======================================================

const getAllSeoSettings = async (req, res) => {
  try {
    const seoSettings =
      await SeoSetting.find()
        .sort({
          page: 1
        })
        .lean();

    return res.status(200).json({
      success: true,
      count: seoSettings.length,
      data: seoSettings
    });

  } catch (error) {
    console.error(
      "GET ALL SEO SETTINGS ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get SEO settings"
    });
  }
};


// ======================================================
// GET SEO SETTING BY PAGE
// ======================================================

const getSeoSettingByPage = async (
  req,
  res
) => {
  try {
    const { page } =
      req.params;

    // --------------------------------------------------
    // VALIDATION
    // --------------------------------------------------

    if (
      !isValidRequiredString(
        page,
        MAX_PAGE_LENGTH
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid page"
      });
    }

    const normalizedPage =
      normalizeString(page);

    // --------------------------------------------------
    // FIND PUBLIC SEO DATA
    // --------------------------------------------------

    const seoSetting =
      await SeoSetting.findOne({
        page: normalizedPage
      })
        .select(
          "page title description keywords canonicalUrl ogTitle ogDescription ogImage robots -_id"
        )
        .lean();

    if (!seoSetting) {
      return res.status(404).json({
        success: false,
        message:
          "SEO setting not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: seoSetting
    });

  } catch (error) {
    console.error(
      "GET SEO SETTING ERROR:",
      error.message
    );

    return res.status(500).json({
      success: false,
      message:
        "Failed to get SEO setting"
    });
  }
};


// ======================================================
// UPDATE SEO SETTING
// ======================================================

const updateSeoSetting = async (
  req,
  res
) => {
  try {
    const { id } =
      req.params;

    // --------------------------------------------------
    // ID VALIDATION
    // --------------------------------------------------

    if (!id) {
      return res.status(400).json({
        success: false,
        message:
          "SEO setting ID is required"
      });
    }

    // --------------------------------------------------
    // FIND EXISTING SETTING
    // --------------------------------------------------

    const seoSetting =
      await SeoSetting.findById(id);

    if (!seoSetting) {
      return res.status(404).json({
        success: false,
        message:
          "SEO setting not found"
      });
    }

    // --------------------------------------------------
    // ALLOWED UPDATE FIELDS
    // --------------------------------------------------

    const allowedFields = [
      "page",
      "title",
      "description",
      "keywords",
      "canonicalUrl",
      "ogTitle",
      "ogDescription",
      "ogImage",
      "robots"
    ];

    const updateData = {};

    for (const field of allowedFields) {
      if (
        Object.prototype.hasOwnProperty.call(
          req.body,
          field
        )
      ) {
        updateData[field] =
          req.body[field];
      }
    }

    // --------------------------------------------------
    // PAGE VALIDATION
    // --------------------------------------------------

    if (
      updateData.page !== undefined &&
      !isValidRequiredString(
        updateData.page,
        MAX_PAGE_LENGTH
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Page must be a valid string"
      });
    }

    // --------------------------------------------------
    // TITLE VALIDATION
    // --------------------------------------------------

    if (
      updateData.title !== undefined &&
      !isValidRequiredString(
        updateData.title,
        MAX_TITLE_LENGTH
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Title must be a valid string"
      });
    }

    // --------------------------------------------------
    // OPTIONAL FIELD VALIDATION
    // --------------------------------------------------

    if (
      updateData.description !== undefined &&
      !isValidOptionalString(
        updateData.description,
        MAX_DESCRIPTION_LENGTH
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Description must be a valid string"
      });
    }

    if (
      updateData.keywords !== undefined &&
      !isValidOptionalString(
        updateData.keywords,
        MAX_KEYWORDS_LENGTH
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Keywords must be a valid string"
      });
    }

    if (
      updateData.canonicalUrl !== undefined &&
      !isValidOptionalString(
        updateData.canonicalUrl,
        MAX_URL_LENGTH
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Canonical URL must be a valid string"
      });
    }

    if (
      updateData.ogTitle !== undefined &&
      !isValidOptionalString(
        updateData.ogTitle,
        MAX_TITLE_LENGTH
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "OG title must be a valid string"
      });
    }

    if (
      updateData.ogDescription !== undefined &&
      !isValidOptionalString(
        updateData.ogDescription,
        MAX_DESCRIPTION_LENGTH
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "OG description must be a valid string"
      });
    }

    if (
      updateData.ogImage !== undefined &&
      !isValidOptionalString(
        updateData.ogImage,
        MAX_URL_LENGTH
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "OG image URL must be a valid string"
      });
    }

    if (
      updateData.robots !== undefined &&
      !isValidOptionalString(
        updateData.robots,
        MAX_ROBOTS_LENGTH
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Robots value must be a valid string"
      });
    }

    // --------------------------------------------------
    // NORMALIZE PAGE/TITLE
    // --------------------------------------------------

    if (updateData.page !== undefined) {
      updateData.page =
        normalizeString(
          updateData.page
        );

      // Check duplicate page
      const duplicate =
        await SeoSetting.findOne({
          page: updateData.page,
          _id: {
            $ne: seoSetting._id
          }
        });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message:
            "SEO setting for this page already exists"
        });
      }
    }

    if (updateData.title !== undefined) {
      updateData.title =
        normalizeString(
          updateData.title
        );
    }

    // --------------------------------------------------
    // AUDIT USER
    // --------------------------------------------------

    updateData.updatedBy =
      req.userId;

    // --------------------------------------------------
    // UPDATE
    // --------------------------------------------------

    const updatedSeoSetting =
      await SeoSetting.findByIdAndUpdate(
        id,
        updateData,
        {
          new: true,
          runValidators: true
        }
      );

    return res.status(200).json({
      success: true,
      message:
        "SEO setting updated successfully",
      data: updatedSeoSetting
    });

  } catch (error) {
    console.error(
      "UPDATE SEO SETTING ERROR:",
      error.message
    );

    // Handle invalid MongoDB ObjectId
    if (
      error.name ===
      "CastError"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid SEO setting ID"
      });
    }

    // Handle duplicate page
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "SEO setting for this page already exists"
      });
    }

    // Handle Mongoose validation
    if (
      error.name ===
      "ValidationError"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid SEO setting data"
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to update SEO setting"
    });
  }
};


// ======================================================
// DELETE SEO SETTING
// ======================================================

const deleteSeoSetting = async (
  req,
  res
) => {
  try {
    const { id } =
      req.params;

    // --------------------------------------------------
    // ID VALIDATION
    // --------------------------------------------------

    if (!id) {
      return res.status(400).json({
        success: false,
        message:
          "SEO setting ID is required"
      });
    }

    // --------------------------------------------------
    // FIND SETTING
    // --------------------------------------------------

    const seoSetting =
      await SeoSetting.findById(id);

    if (!seoSetting) {
      return res.status(404).json({
        success: false,
        message:
          "SEO setting not found"
      });
    }

    // --------------------------------------------------
    // DELETE
    // --------------------------------------------------

    await SeoSetting.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message:
        "SEO setting deleted successfully"
    });

  } catch (error) {
    console.error(
      "DELETE SEO SETTING ERROR:",
      error.message
    );

    // Handle invalid MongoDB ObjectId
    if (
      error.name ===
      "CastError"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid SEO setting ID"
      });
    }

    return res.status(500).json({
      success: false,
      message:
        "Failed to delete SEO setting"
    });
  }
};


// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  createSeoSetting,
  getAllSeoSettings,
  getSeoSettingByPage,
  updateSeoSetting,
  deleteSeoSetting
};
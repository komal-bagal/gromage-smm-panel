const Banner = require("../models/Banner");

// Create banner
const createBanner = async (req, res) => {
  try {
    const {
      title,
      image,
      link,
      description,
      position,
      sortOrder,
      isPublic,
      isActive,
      startDate,
      endDate
    } = req.body;

    if (!title || !image) {
      return res.status(400).json({
        success: false,
        message: "Title and image are required"
      });
    }

    const banner = await Banner.create({
      title,
      image,
      link,
      description,
      position,
      sortOrder,
      isPublic,
      isActive,
      startDate,
      endDate,
      updatedBy: req.user?._id || null
    });

    res.status(201).json({
      success: true,
      message: "Banner created successfully",
      data: banner
    });
  } catch (error) {
    console.error("CREATE BANNER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create banner",
      error: error.message
    });
  }
};


// Get all banners
const getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find()
      .sort({ sortOrder: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: banners.length,
      data: banners
    });
  } catch (error) {
    console.error("GET ALL BANNERS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch banners",
      error: error.message
    });
  }
};


// Get public active banners
const getPublicBanners = async (req, res) => {
  try {
    const now = new Date();

    const banners = await Banner.find({
      isPublic: true,
      isActive: true,
      $and: [
        {
          $or: [
            { startDate: null },
            { startDate: { $lte: now } }
          ]
        },
        {
          $or: [
            { endDate: null },
            { endDate: { $gte: now } }
          ]
        }
      ]
    }).sort({
      position: 1,
      sortOrder: 1
    });

    res.status(200).json({
      success: true,
      count: banners.length,
      data: banners
    });
  } catch (error) {
    console.error("GET PUBLIC BANNERS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch public banners",
      error: error.message
    });
  }
};


// Get banner by ID
const getBannerById = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found"
      });
    }

    res.status(200).json({
      success: true,
      data: banner
    });
  } catch (error) {
    console.error("GET BANNER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch banner",
      error: error.message
    });
  }
};


// Update banner
const updateBanner = async (req, res) => {
  try {
    const {
      title,
      image,
      link,
      description,
      position,
      sortOrder,
      isPublic,
      isActive,
      startDate,
      endDate
    } = req.body;

    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found"
      });
    }

    if (title !== undefined) banner.title = title;
    if (image !== undefined) banner.image = image;
    if (link !== undefined) banner.link = link;
    if (description !== undefined) banner.description = description;
    if (position !== undefined) banner.position = position;
    if (sortOrder !== undefined) banner.sortOrder = sortOrder;
    if (isPublic !== undefined) banner.isPublic = isPublic;
    if (isActive !== undefined) banner.isActive = isActive;
    if (startDate !== undefined) banner.startDate = startDate;
    if (endDate !== undefined) banner.endDate = endDate;

    banner.updatedBy = req.user?._id || banner.updatedBy;

    await banner.save();

    res.status(200).json({
      success: true,
      message: "Banner updated successfully",
      data: banner
    });
  } catch (error) {
    console.error("UPDATE BANNER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update banner",
      error: error.message
    });
  }
};


// Delete banner
const deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found"
      });
    }

    await Banner.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Banner deleted successfully"
    });
  } catch (error) {
    console.error("DELETE BANNER ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete banner",
      error: error.message
    });
  }
};


module.exports = {
  createBanner,
  getAllBanners,
  getPublicBanners,
  getBannerById,
  updateBanner,
  deleteBanner
};
const CmsPage = require("../models/CmsPage");

// Create CMS page
const createPage = async (req, res) => {
  try {
    const {
      slug,
      title,
      content,
      status,
      isPublic,
      metaTitle,
      metaDescription,
      metaKeywords
    } = req.body;

    if (!slug || !title) {
      return res.status(400).json({
        success: false,
        message: "Slug and title are required"
      });
    }

    const existingPage = await CmsPage.findOne({
      slug: slug.trim().toLowerCase()
    });

    if (existingPage) {
      return res.status(409).json({
        success: false,
        message: "A page with this slug already exists"
      });
    }

    const page = await CmsPage.create({
      slug: slug.trim().toLowerCase(),
      title,
      content: content || "",
      status: status || "draft",
      isPublic: isPublic !== undefined ? isPublic : true,
      metaTitle: metaTitle || "",
      metaDescription: metaDescription || "",
      metaKeywords: metaKeywords || "",
      updatedBy: req.userId || null
    });

    return res.status(201).json({
      success: true,
      message: "CMS page created successfully",
      data: page
    });
  } catch (error) {
    console.error("CREATE CMS PAGE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create CMS page"
    });
  }
};

// Get all CMS pages
const getAllPages = async (req, res) => {
  try {
    const {
      status,
      isPublic,
      page = 1,
      limit = 20
    } = req.query;

    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (isPublic !== undefined) {
      filter.isPublic = isPublic === "true";
    }

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(
      Math.max(parseInt(limit, 10) || 20, 1),
      100
    );

    const skip = (pageNumber - 1) * limitNumber;

    const [pages, total] = await Promise.all([
      CmsPage.find(filter)
        .populate("updatedBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),

      CmsPage.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      data: pages,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber)
      }
    });
  } catch (error) {
    console.error("GET CMS PAGES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch CMS pages"
    });
  }
};

// Get published public page by slug
const getPublicPage = async (req, res) => {
  try {
    const { slug } = req.params;

    const page = await CmsPage.findOne({
      slug: slug.toLowerCase(),
      status: "published",
      isPublic: true
    }).select(
      "slug title content status isPublic metaTitle metaDescription metaKeywords"
    );

    if (!page) {
      return res.status(404).json({
        success: false,
        message: "Public page not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: page
    });
  } catch (error) {
    console.error("GET PUBLIC CMS PAGE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch public CMS page"
    });
  }
};

// Get page by slug
const getPageBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const page = await CmsPage.findOne({
      slug: slug.toLowerCase()
    }).populate("updatedBy", "name email");

    if (!page) {
      return res.status(404).json({
        success: false,
        message: "CMS page not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: page
    });
  } catch (error) {
    console.error("GET CMS PAGE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch CMS page"
    });
  }
};

// Update CMS page
const updatePage = async (req, res) => {
  try {
    const { slug } = req.params;

    const page = await CmsPage.findOne({
      slug: slug.toLowerCase()
    });

    if (!page) {
      return res.status(404).json({
        success: false,
        message: "CMS page not found"
      });
    }

    const {
      title,
      content,
      status,
      isPublic,
      metaTitle,
      metaDescription,
      metaKeywords,
      newSlug
    } = req.body;

    if (title !== undefined) {
      page.title = title;
    }

    if (content !== undefined) {
      page.content = content;
    }

    if (status !== undefined) {
      page.status = status;
    }

    if (isPublic !== undefined) {
      page.isPublic = isPublic;
    }

    if (metaTitle !== undefined) {
      page.metaTitle = metaTitle;
    }

    if (metaDescription !== undefined) {
      page.metaDescription = metaDescription;
    }

    if (metaKeywords !== undefined) {
      page.metaKeywords = metaKeywords;
    }

    if (newSlug !== undefined) {
      const normalizedSlug = newSlug.trim().toLowerCase();

      const existingPage = await CmsPage.findOne({
        slug: normalizedSlug,
        _id: { $ne: page._id }
      });

      if (existingPage) {
        return res.status(409).json({
          success: false,
          message: "A page with this slug already exists"
        });
      }

      page.slug = normalizedSlug;
    }

    page.updatedBy = req.userId || page.updatedBy;

    await page.save();

    return res.status(200).json({
      success: true,
      message: "CMS page updated successfully",
      data: page
    });
  } catch (error) {
    console.error("UPDATE CMS PAGE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update CMS page"
    });
  }
};

// Delete CMS page
const deletePage = async (req, res) => {
  try {
    const { slug } = req.params;

    const page = await CmsPage.findOneAndDelete({
      slug: slug.toLowerCase()
    });

    if (!page) {
      return res.status(404).json({
        success: false,
        message: "CMS page not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "CMS page deleted successfully"
    });
  } catch (error) {
    console.error("DELETE CMS PAGE ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete CMS page"
    });
  }
};

module.exports = {
  createPage,
  getAllPages,
  getPublicPage,
  getPageBySlug,
  updatePage,
  deletePage
};
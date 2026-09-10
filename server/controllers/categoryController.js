const Category = require("../models/Category");

// ======================================================
// CREATE CATEGORY
// ======================================================

const createCategory = async (req, res) => {
  try {
    const { name, description, status, sortOrder } = req.body || {};

    // --------------------------------------------------
    // VALIDATE NAME
    // --------------------------------------------------

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Category name is required"
      });
    }

    // --------------------------------------------------
    // CHECK DUPLICATE CATEGORY
    // --------------------------------------------------

    const existingCategory = await Category.findOne({
      name: name.trim()
    });

    if (existingCategory) {
      return res.status(409).json({
        message: "Category already exists"
      });
    }

    // --------------------------------------------------
    // CREATE CATEGORY
    // --------------------------------------------------

    const category = await Category.create({
      name: name.trim(),
      description: description ? description.trim() : "",
      status: status || "active",
      sortOrder:
        sortOrder !== undefined ? Number(sortOrder) : 0
    });

    return res.status(201).json({
      message: "Category created successfully",
      category
    });

  } catch (error) {
    console.error("CREATE CATEGORY ERROR:", error);

    // Duplicate name protection
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Category already exists"
      });
    }

    return res.status(500).json({
      message: "Server error"
    });
  }
};


// ======================================================
// GET ALL CATEGORIES
// ======================================================

const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find()
      .sort({
        sortOrder: 1,
        createdAt: -1
      });

    return res.status(200).json({
      message: "Categories fetched successfully",
      count: categories.length,
      categories
    });

  } catch (error) {
    console.error("GET ALL CATEGORIES ERROR:", error);

    return res.status(500).json({
      message: "Server error"
    });
  }
};


// ======================================================
// GET SINGLE CATEGORY
// ======================================================

const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(
      req.params.categoryId
    );

    if (!category) {
      return res.status(404).json({
        message: "Category not found"
      });
    }

    return res.status(200).json({
      message: "Category fetched successfully",
      category
    });

  } catch (error) {
    console.error("GET CATEGORY BY ID ERROR:", error);

    return res.status(500).json({
      message: "Server error"
    });
  }
};


// ======================================================
// UPDATE CATEGORY
// ======================================================

const updateCategory = async (req, res) => {
  try {
    const {
      name,
      description,
      status,
      sortOrder
    } = req.body || {};

    const category = await Category.findById(
      req.params.categoryId
    );

    if (!category) {
      return res.status(404).json({
        message: "Category not found"
      });
    }

    // --------------------------------------------------
    // UPDATE NAME
    // --------------------------------------------------

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          message: "Category name cannot be empty"
        });
      }

      const duplicateCategory = await Category.findOne({
        name: name.trim(),
        _id: {
          $ne: category._id
        }
      });

      if (duplicateCategory) {
        return res.status(409).json({
          message: "Category already exists"
        });
      }

      category.name = name.trim();
    }

    // --------------------------------------------------
    // UPDATE DESCRIPTION
    // --------------------------------------------------

    if (description !== undefined) {
      category.description = description.trim();
    }

    // --------------------------------------------------
    // UPDATE STATUS
    // --------------------------------------------------

    if (status !== undefined) {
      if (!["active", "inactive"].includes(status)) {
        return res.status(400).json({
          message: "Invalid status"
        });
      }

      category.status = status;
    }

    // --------------------------------------------------
    // UPDATE SORT ORDER
    // --------------------------------------------------

    if (sortOrder !== undefined) {
      const numericSortOrder = Number(sortOrder);

      if (
        !Number.isFinite(numericSortOrder) ||
        numericSortOrder < 0
      ) {
        return res.status(400).json({
          message: "Sort order must be a valid non-negative number"
        });
      }

      category.sortOrder = numericSortOrder;
    }

    await category.save();

    return res.status(200).json({
      message: "Category updated successfully",
      category
    });

  } catch (error) {
    console.error("UPDATE CATEGORY ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "Category already exists"
      });
    }

    return res.status(500).json({
      message: "Server error"
    });
  }
};


// ======================================================
// DELETE CATEGORY
// ======================================================

const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(
      req.params.categoryId
    );

    if (!category) {
      return res.status(404).json({
        message: "Category not found"
      });
    }

    await Category.findByIdAndDelete(
      req.params.categoryId
    );

    return res.status(200).json({
      message: "Category deleted successfully"
    });

  } catch (error) {
    console.error("DELETE CATEGORY ERROR:", error);

    return res.status(500).json({
      message: "Server error"
    });
  }
};


// ======================================================
// EXPORT
// ======================================================

module.exports = {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory
};
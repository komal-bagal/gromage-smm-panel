const mongoose = require("mongoose");
const Category = require("../models/Category");

const getCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({
      sortOrder: 1,
      createdAt: -1,
    });
    return res.status(200).json({
      success: true,
      categories,
    });
  } catch (error) {
    console.error("Get Categories Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch categories",
    });
  }
};

const getCategoryById = async (req, res) => {
  try {
    const { categoryId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      category,
    });
  } catch (error) {
    console.error("Get Category By ID Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch category",
    });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name, description, status, sortOrder } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    const normalizedStatus =
      String(status).toLowerCase() === "inactive" ||
      String(status).toLowerCase() === "disabled"
        ? "inactive"
        : "active";

    const newCategory = await Category.create({
      name: String(name).trim(),
      description: description ? String(description).trim() : "",
      status: normalizedStatus,
      sortOrder: sortOrder !== undefined ? Number(sortOrder) || 1 : 1,
    });

    return res.status(201).json({
      success: true,
      category: newCategory,
      message: "Category created successfully",
    });
  } catch (error) {
    console.error("Create Category Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create category",
    });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const { name, description, status, sortOrder } = req.body;
    const updateData = {};

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({
          success: false,
          message: "Category name cannot be empty",
        });
      }
      updateData.name = String(name).trim();
      updateData.slug = String(name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }

    if (description !== undefined) {
      updateData.description = String(description).trim();
    }

    if (status !== undefined) {
      const s = String(status).toLowerCase();
      updateData.status =
        s === "inactive" || s === "disabled" ? "inactive" : "active";
    }

    if (sortOrder !== undefined) {
      updateData.sortOrder = Number(sortOrder) || 1;
    }

    const updated = await Category.findByIdAndUpdate(
      categoryId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      category: updated,
      message: "Category updated successfully",
    });
  } catch (error) {
    console.error("Update Category Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update category",
    });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    const deleted = await Category.findByIdAndDelete(categoryId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    console.error("Delete Category Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete category",
    });
  }
};

module.exports = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};

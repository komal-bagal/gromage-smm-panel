const mongoose = require("mongoose");

const cmsPageSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    content: {
      type: String,
      default: ""
    },

    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
      index: true
    },

    isPublic: {
      type: Boolean,
      default: true,
      index: true
    },

    metaTitle: {
      type: String,
      default: "",
      trim: true
    },

    metaDescription: {
      type: String,
      default: "",
      trim: true
    },

    metaKeywords: {
      type: String,
      default: "",
      trim: true
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  {
    timestamps: true
  }
);

const CmsPage =
  mongoose.models.CmsPage ||
  mongoose.model("CmsPage", cmsPageSchema);

module.exports = CmsPage;
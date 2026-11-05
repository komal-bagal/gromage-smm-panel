const mongoose = require("mongoose");

const cmsSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },

    value: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },

    type: {
      type: String,
      enum: [
        "text",
        "number",
        "boolean",
        "json",
        "image",
        "url"
      ],
      default: "text"
    },

    category: {
      type: String,
      enum: [
        "general",
        "branding",
        "payment",
        "seo",
        "social",
        "notification",
        "security",
        "other"
      ],
      default: "general",
      index: true
    },

    description: {
      type: String,
      default: ""
    },

    isPublic: {
      type: Boolean,
      default: false
    },

    isActive: {
      type: Boolean,
      default: true
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

const CmsSetting =
  mongoose.models.CmsSetting ||
  mongoose.model("CmsSetting", cmsSettingSchema);

module.exports = CmsSetting;
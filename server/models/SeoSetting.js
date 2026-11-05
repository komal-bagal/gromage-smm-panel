const mongoose = require("mongoose");

const seoSettingSchema = new mongoose.Schema(
  {
    page: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      default: "",
      trim: true
    },

    keywords: {
      type: String,
      default: "",
      trim: true
    },

    canonicalUrl: {
      type: String,
      default: "",
      trim: true
    },

    ogTitle: {
      type: String,
      default: "",
      trim: true
    },

    ogDescription: {
      type: String,
      default: "",
      trim: true
    },

    ogImage: {
      type: String,
      default: "",
      trim: true
    },

    robots: {
      type: String,
      default: "index, follow",
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

const SeoSetting =
  mongoose.models.SeoSetting ||
  mongoose.model("SeoSetting", seoSettingSchema);

console.log("========== SEO SETTING MODEL LOADED ==========");
console.log("SeoSetting:", SeoSetting);
console.log("SeoSetting type:", typeof SeoSetting);
console.log("SeoSetting.findOne:", typeof SeoSetting.findOne);
console.log("SeoSetting.find:", typeof SeoSetting.find);
console.log("SeoSetting.create:", typeof SeoSetting.create);
console.log("SeoSetting.findById:", typeof SeoSetting.findById);
console.log("==============================================");

module.exports = SeoSetting;
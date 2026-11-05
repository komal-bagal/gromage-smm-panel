const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },

    image: {
      type: String,
      required: true,
      trim: true
    },

    link: {
      type: String,
      default: "",
      trim: true
    },

    description: {
      type: String,
      default: "",
      trim: true
    },

    position: {
      type: String,
      enum: [
        "home_top",
        "home_middle",
        "home_bottom",
        "other"
      ],
      default: "home_top",
      index: true
    },

    sortOrder: {
      type: Number,
      default: 0,
      index: true
    },

    isPublic: {
      type: Boolean,
      default: true,
      index: true
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
    },

    startDate: {
      type: Date,
      default: null
    },

    endDate: {
      type: Date,
      default: null
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

const Banner =
  mongoose.models.Banner ||
  mongoose.model("Banner", bannerSchema);

module.exports = Banner;
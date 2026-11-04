const mongoose = require("mongoose");

const affiliateSettingSchema = new mongoose.Schema(
  {
    commissionRate: {
      type: Number,
      default: 5,
      min: [0, "Commission rate cannot be negative"],
      max: [100, "Commission rate cannot exceed 100%"],
    },
    minPayout: {
      type: Number,
      default: 500,
      min: [1, "Minimum payout must be at least 1"],
    },
    cookieDays: {
      type: Number,
      default: 30,
      min: [1, "Cookie tracking days must be at least 1"],
    },
  },
  {
    timestamps: true,
  }
);

// Helper static method to fetch singleton settings or initialize default
affiliateSettingSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({
      commissionRate: 5,
      minPayout: 500,
      cookieDays: 30,
    });
  }
  return settings;
};

module.exports = mongoose.model("AffiliateSetting", affiliateSettingSchema);

const cron = require("node-cron");
const Coupon = require("../models/Coupon");

const cleanupExpiredCoupons = async () => {
  try {
    const now = new Date();

    const result = await Coupon.updateMany(
      {
        expiryDate: { $ne: null, $lt: now },
        isActive: true,
      },
      {
        $set: { isActive: false },
      }
    );

    if (result.modifiedCount > 0) {
      console.log(
        `🎟️ Coupon Cleanup: ${result.modifiedCount} expired coupon(s) deactivated.`
      );
    } else {
      console.log("🎟️ Coupon Cleanup: No expired active coupons found.");
    }
  } catch (error) {
    console.error("❌ Coupon Cleanup Error:", error.message);
  }
};

// Runs every hour
cron.schedule("0 * * * *", cleanupExpiredCoupons);

console.log("🎟️ Coupon cleanup cron job started.");

module.exports = cleanupExpiredCoupons;
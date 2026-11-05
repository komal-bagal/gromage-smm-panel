
const mongoose = require("mongoose");

const {
  retryFailedProviderStatusJob
} = require("../services/providerStatusRecoveryService");

const retryFailedStatus = async (req, res) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID"
      });
    }

    const result = await retryFailedProviderStatusJob(orderId);

    console.warn("PROVIDER STATUS RECOVERY REQUESTED", {
      orderId,
      requestedBy: req.user?.email || req.user?._id,
      role: req.user?.role,
      jobId: result.jobId
    });

    return res.status(200).json(result);
  } catch (error) {
    const message = error.message || "Provider status recovery failed";

    const clientErrors = [
      "Invalid order ID",
      "Order not found or is not eligible for provider status recovery",
      "Provider status job not found"
    ];

    if (
      clientErrors.includes(message) ||
      message.startsWith("Cannot recover job:")
    ) {
      return res.status(400).json({
        success: false,
        message
      });
    }

    console.error("PROVIDER STATUS RECOVERY ERROR", {
      orderId: req.params.orderId,
      message
    });

    return res.status(500).json({
      success: false,
      message: "Provider status recovery failed"
    });
  }
};

module.exports = {
  retryFailedStatus
};

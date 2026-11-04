const PaymentSetting = require("../models/PaymentSetting");

const KNOWN_GATEWAYS = [
  "razorpay",
  "cashfree",
  "phonepe",
  "stripe",
  "paypal",
  "manualupi",
];

/**
 * Normalizes input gateway key to standard canonical lowercase name
 */
const normalizeGatewayKey = (key) => {
  if (!key || typeof key !== "string") return null;
  const k = key.toLowerCase().replace(/[-_]/g, "");
  if (k === "phonepe") return "phonepe";
  if (k === "manualupi" || k === "upi") return "manualupi";
  if (KNOWN_GATEWAYS.includes(k)) return k;
  return null;
};

/**
 * Checks whether a secret string is a masked placeholder (e.g. ••••••••••••••••)
 */
const isMaskedSecret = (val) => {
  if (typeof val !== "string") return false;
  return val.includes("•") || val.includes("●") || /^\*+$/.test(val.trim());
};

/**
 * GET /api/settings/payment
 * Retrieve global payment gateway settings with masked secrets (Admin only)
 */
const getPaymentSettings = async (req, res) => {
  try {
    const settings = await PaymentSetting.getSettings();
    const safeSettings = settings.toSafeJSON();

    return res.status(200).json({
      success: true,
      settings: safeSettings,
      paymentSettings: safeSettings,
      data: safeSettings,
    });
  } catch (error) {
    console.error("Get Payment Settings Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve payment settings",
      error: error.message,
    });
  }
};

/**
 * PUT /api/settings/payment
 * Update global payment gateway settings (Admin only)
 * Preserves unmentioned gateways and keeps existing secrets if masked placeholder is passed
 */
const updatePaymentSettings = async (req, res) => {
  try {
    const payload = req.body || {};
    // Unwrap nested objects if frontend wrapped under settings or paymentSettings
    const rawData =
      payload.paymentSettings && typeof payload.paymentSettings === "object"
        ? payload.paymentSettings
        : payload.settings && typeof payload.settings === "object"
        ? payload.settings
        : payload;

    const settings = await PaymentSetting.getSettings();

    // Iterate over keys in payload and update matching gateways
    let hasUpdatedAny = false;

    for (const [rawKey, incomingGw] of Object.entries(rawData)) {
      if (!incomingGw || typeof incomingGw !== "object") continue;
      const canonicalKey = normalizeGatewayKey(rawKey);
      if (!canonicalKey) continue;

      const currentGw = settings[canonicalKey] || {};

      // 1. Boolean flags (enabled / testMode)
      if (incomingGw.enabled !== undefined) {
        currentGw.enabled = Boolean(incomingGw.enabled);
      } else if (incomingGw.isEnabled !== undefined) {
        currentGw.enabled = Boolean(incomingGw.isEnabled);
      }

      if (incomingGw.testMode !== undefined) {
        currentGw.testMode = Boolean(incomingGw.testMode);
      }

      // 2. KeyId
      if (incomingGw.keyId !== undefined) {
        currentGw.keyId = String(incomingGw.keyId).trim();
      }

      // 3. Fee Percent
      if (incomingGw.feePercent !== undefined) {
        const fee = Number(incomingGw.feePercent);
        if (isNaN(fee) || fee < 0 || fee > 100) {
          return res.status(400).json({
            success: false,
            message: `Invalid fee percentage for ${canonicalKey}: must be between 0 and 100`,
          });
        }
        currentGw.feePercent = fee;
      }

      // 4. Min Deposit
      if (incomingGw.minDeposit !== undefined) {
        const minDep = Number(incomingGw.minDeposit);
        if (isNaN(minDep) || minDep < 0) {
          return res.status(400).json({
            success: false,
            message: `Invalid minimum deposit for ${canonicalKey}: must be non-negative`,
          });
        }
        currentGw.minDeposit = minDep;
      }

      // 5. Max Deposit
      if (incomingGw.maxDeposit !== undefined) {
        const maxDep = Number(incomingGw.maxDeposit);
        if (isNaN(maxDep) || maxDep < 0) {
          return res.status(400).json({
            success: false,
            message: `Invalid maximum deposit for ${canonicalKey}: must be non-negative`,
          });
        }
        currentGw.maxDeposit = maxDep;
      }

      // Validate maxDeposit >= minDeposit if maxDeposit > 0
      if (
        currentGw.maxDeposit > 0 &&
        currentGw.minDeposit > 0 &&
        currentGw.maxDeposit < currentGw.minDeposit
      ) {
        return res.status(400).json({
          success: false,
          message: `Maximum deposit for ${canonicalKey} must be greater than or equal to minimum deposit`,
        });
      }

      // 6. Secret: Only update if a real new secret is provided (not empty and not masked placeholder)
      const rawSecret =
        incomingGw.newSecret !== undefined
          ? incomingGw.newSecret
          : incomingGw.secret;

      if (rawSecret !== undefined && typeof rawSecret === "string") {
        const cleanSecret = rawSecret.trim();
        if (cleanSecret && !isMaskedSecret(cleanSecret)) {
          currentGw.secret = cleanSecret;
        }
      }

      settings[canonicalKey] = currentGw;
      settings.markModified(canonicalKey);
      hasUpdatedAny = true;
    }

    if (hasUpdatedAny) {
      await settings.save();
    }

    const safeSettings = settings.toSafeJSON();

    return res.status(200).json({
      success: true,
      message: "Payment gateway settings updated successfully",
      settings: safeSettings,
      paymentSettings: safeSettings,
      data: safeSettings,
    });
  } catch (error) {
    console.error("Update Payment Settings Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update payment settings",
      error: error.message,
    });
  }
};

module.exports = {
  getPaymentSettings,
  updatePaymentSettings,
};

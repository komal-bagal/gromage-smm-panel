const mongoose = require("mongoose");

const gatewaySchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      default: false,
    },
    testMode: {
      type: Boolean,
      default: false,
    },
    keyId: {
      type: String,
      default: "",
      trim: true,
    },
    feePercent: {
      type: Number,
      default: 0,
      min: [0, "Fee percent cannot be negative"],
      max: [100, "Fee percent cannot exceed 100%"],
    },
    minDeposit: {
      type: Number,
      default: 50,
      min: [0, "Minimum deposit cannot be negative"],
    },
    maxDeposit: {
      type: Number,
      default: 50000,
      min: [0, "Maximum deposit cannot be negative"],
    },
    secret: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false }
);

const paymentSettingSchema = new mongoose.Schema(
  {
    razorpay: {
      type: gatewaySchema,
      default: () => ({
        enabled: true,
        testMode: false,
        keyId: "rzp_live_8X9K3mP09qL82",
        feePercent: 2.0,
        minDeposit: 100,
        maxDeposit: 100000,
        secret: "rzp_sec_live_default_secret_key",
      }),
    },
    cashfree: {
      type: gatewaySchema,
      default: () => ({
        enabled: true,
        testMode: false,
        keyId: "CF_APP_992384102941",
        feePercent: 1.8,
        minDeposit: 100,
        maxDeposit: 100000,
        secret: "cf_sec_live_default_secret_key",
      }),
    },
    phonepe: {
      type: gatewaySchema,
      default: () => ({
        enabled: true,
        testMode: true,
        keyId: "M2209183492810_LIVE",
        feePercent: 0.0,
        minDeposit: 50,
        maxDeposit: 50000,
        secret: "phonepe_sec_test_secret_key",
      }),
    },
    stripe: {
      type: gatewaySchema,
      default: () => ({
        enabled: false,
        testMode: true,
        keyId: "pk_test_51O9k283LKMz09X1",
        feePercent: 3.5,
        minDeposit: 500,
        maxDeposit: 250000,
        secret: "sk_test_default_secret_key",
      }),
    },
    paypal: {
      type: gatewaySchema,
      default: () => ({
        enabled: false,
        testMode: true,
        keyId: "",
        feePercent: 4.0,
        minDeposit: 500,
        maxDeposit: 250000,
        secret: "",
      }),
    },
    manualupi: {
      type: gatewaySchema,
      default: () => ({
        enabled: true,
        testMode: false,
        keyId: "upi@gromage",
        feePercent: 0.0,
        minDeposit: 50,
        maxDeposit: 100000,
        secret: "",
      }),
    },
  },
  {
    timestamps: true,
  }
);

// Helper static method to fetch singleton settings or initialize default document
paymentSettingSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

// Safe serializer that never exposes raw gateway secrets
paymentSettingSchema.methods.toSafeJSON = function () {
  const doc = this.toObject();
  const gateways = [
    "razorpay",
    "cashfree",
    "phonepe",
    "stripe",
    "paypal",
    "manualupi",
  ];
  const safeGateways = {};

  for (const gw of gateways) {
    const item = doc[gw] || {};
    const rawSecret = item.secret ? String(item.secret).trim() : "";
    const hasSecret = Boolean(rawSecret);

    safeGateways[gw] = {
      enabled: Boolean(item.enabled),
      testMode: Boolean(item.testMode),
      keyId: item.keyId || "",
      feePercent: item.feePercent !== undefined ? Number(item.feePercent) : 0,
      minDeposit: item.minDeposit !== undefined ? Number(item.minDeposit) : 0,
      maxDeposit: item.maxDeposit !== undefined ? Number(item.maxDeposit) : 0,
      secret: hasSecret ? "••••••••••••••••" : "",
      secretMasked: hasSecret ? "••••••••••••••••" : "",
      hasSecret,
    };
  }

  // Provide camelCase aliases for phonePe and manualUpi to support any frontend case convention
  safeGateways.phonePe = safeGateways.phonepe;
  safeGateways.manualUpi = safeGateways.manualupi;

  return safeGateways;
};

module.exports = mongoose.model("PaymentSetting", paymentSettingSchema);

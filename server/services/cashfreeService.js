const axios = require("axios");
const crypto = require("crypto");

// ======================================================
// CASHFREE CONFIGURATION
// ======================================================

const CASHFREE_ENVIRONMENT = (
  process.env.CASHFREE_ENVIRONMENT || "sandbox"
).toLowerCase();

const CASHFREE_CLIENT_ID = process.env.CASHFREE_CLIENT_ID;
const CASHFREE_CLIENT_SECRET = process.env.CASHFREE_CLIENT_SECRET;

const CASHFREE_API_VERSION =
  process.env.CASHFREE_API_VERSION || "2025-01-01";

const CASHFREE_API_DOMAIN =
  CASHFREE_ENVIRONMENT === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

const CASHFREE_RETURN_URL = process.env.CASHFREE_RETURN_URL;
const CASHFREE_NOTIFY_URL = process.env.CASHFREE_NOTIFY_URL;

// ======================================================
// CONFIG VALIDATION
// ======================================================

function validateCashfreeConfig() {
  const missing = [];

  if (!CASHFREE_CLIENT_ID) {
    missing.push("CASHFREE_CLIENT_ID");
  }

  if (!CASHFREE_CLIENT_SECRET) {
    missing.push("CASHFREE_CLIENT_SECRET");
  }

  if (!CASHFREE_RETURN_URL) {
    missing.push("CASHFREE_RETURN_URL");
  }

  if (!["sandbox", "production"].includes(CASHFREE_ENVIRONMENT)) {
    throw new Error(
      "CASHFREE_ENVIRONMENT must be sandbox or production"
    );
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing Cashfree configuration: ${missing.join(", ")}`
    );
  }
}

// ======================================================
// AMOUNT VALIDATION
// ======================================================

function formatCashfreeAmount(amount) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("Payment amount must be greater than zero");
  }

  return Number(numericAmount.toFixed(2));
}

// ======================================================
// DETERMINISTIC ORDER ID
// Same reference => same order ID.
// ======================================================

function generateCashfreeOrderId(reference) {
  if (!reference || !String(reference).trim()) {
    throw new Error("Payment reference is required");
  }

  const referenceString = String(reference).trim();

  const cleanReference = referenceString
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .slice(0, 25);

  const hash = crypto
    .createHash("sha256")
    .update(referenceString, "utf8")
    .digest("hex")
    .slice(0, 16);

  return `GROMAGE_${cleanReference}_${hash}`.slice(0, 50);
}

// ======================================================
// DETERMINISTIC IDEMPOTENCY KEY
// Same reference => same key.
// ======================================================

function generateCashfreeIdempotencyKey(reference) {
  if (!reference || !String(reference).trim()) {
    throw new Error("Payment reference is required");
  }

  const normalizedReference = String(reference).trim();

  const bytes = crypto
    .createHash("sha256")
    .update(`gromage-cashfree:${normalizedReference}`, "utf8")
    .digest()
    .subarray(0, 16);

  // Create a deterministic UUID-shaped key.
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString("hex");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

// ======================================================
// COMMON API HEADERS
// ======================================================

function getCashfreeHeaders() {
  validateCashfreeConfig();

  return {
    "Content-Type": "application/json",
    "x-client-id": CASHFREE_CLIENT_ID,
    "x-client-secret": CASHFREE_CLIENT_SECRET,
    "x-api-version": CASHFREE_API_VERSION,
  };
}

// ======================================================
// CREATE CASHFREE ORDER
// This function never credits the user's wallet.
// Wallet credit must follow verified payment success.
// ======================================================

async function createCashfreeOrder({
  reference,
  amount,
  userId,
  name,
  email,
  phone,
}) {
  // Local validation happens before any network request.
  // Errors here must not be classified as uncertain outcomes.
  validateCashfreeConfig();

  if (!reference || !String(reference).trim()) {
    throw new Error("Payment reference is required");
  }

  if (!userId) {
    throw new Error("User ID is required");
  }

  if (!email || !String(email).trim()) {
    throw new Error("Customer email is required");
  }

  if (!/^[6-9]\d{9}$/.test(String(phone || ""))) {
    throw new Error(
      "A valid 10-digit customer phone number is required for Cashfree"
    );
  }

  const normalizedReference = String(reference).trim();

  const orderId = generateCashfreeOrderId(normalizedReference);

  const idempotencyKey =
    generateCashfreeIdempotencyKey(normalizedReference);

  const formattedAmount = formatCashfreeAmount(amount);

  const payload = {
    order_id: orderId,
    order_amount: formattedAmount,
    order_currency: "INR",

    customer_details: {
      customer_id: String(userId),
      customer_name: String(name || "Customer").slice(0, 100),
      customer_email: String(email).trim(),
      customer_phone: String(phone),
    },

    order_meta: {
      return_url: CASHFREE_RETURN_URL,
      ...(CASHFREE_NOTIFY_URL
        ? { notify_url: CASHFREE_NOTIFY_URL }
        : {}),
    },

    order_note: `Gromage recharge ${normalizedReference.slice(0, 200)}`,
  };

  // IMPORTANT:
  // Validate and prepare headers before entering the network
  // request try/catch. A configuration failure is not uncertain.
  const requestHeaders = {
    ...getCashfreeHeaders(),
    "x-idempotency-key": idempotencyKey,
  };

  try {
    const response = await axios.post(
      `${CASHFREE_API_DOMAIN}/orders`,
      payload,
      {
        headers: requestHeaders,
        timeout: 15000,
      }
    );

    const data = response.data;

    if (
      !data ||
      data.order_id !== orderId ||
      typeof data.payment_session_id !== "string" ||
      !data.payment_session_id.trim()
    ) {
      const error = new Error(
        "Invalid Cashfree order creation response"
      );

      error.code = "CASHFREE_UNCERTAIN_OUTCOME";
      error.retryable = true;
      error.outcomeUnknown = true;

      throw error;
    }

    return {
      success: true,
      orderId: data.order_id,
      reference: normalizedReference,
      amount: formattedAmount,
      currency: data.order_currency || "INR",
      paymentSessionId: data.payment_session_id,
      environment: CASHFREE_ENVIRONMENT,

      // Return sanitized gateway metadata only.
      response: {
        cf_order_id: data.cf_order_id || null,
        order_id: data.order_id,
        order_status: data.order_status || null,
        order_amount: data.order_amount,
        order_currency: data.order_currency || "INR",
      },
    };
  } catch (error) {
    const status = error.response?.status || null;

    console.error("CASHFREE CREATE ORDER ERROR:", {
      status,
      code: error.code || null,
      message:
        error.response?.data?.message ||
        error.message ||
        "Cashfree order creation failed",
    });

    // Preserve uncertainty detected after a response was received.
    if (error.outcomeUnknown === true) {
      throw error;
    }

    // A timeout, connection failure, or server error may occur
    // after Cashfree has received the create-order request.
    const isNetworkOrTimeoutError =
      !error.response ||
      error.code === "ECONNABORTED" ||
      error.code === "ETIMEDOUT" ||
      error.code === "ECONNRESET" ||
      error.code === "EPIPE" ||
      error.code === "ERR_NETWORK";

    if (isNetworkOrTimeoutError || status >= 500) {
      const uncertainError = new Error(
        "Cashfree order outcome is uncertain; verify the order before retrying"
      );

      uncertainError.code = "CASHFREE_UNCERTAIN_OUTCOME";
      uncertainError.retryable = true;
      uncertainError.outcomeUnknown = true;

      throw uncertainError;
    }

    // An HTTP rejection is treated as a definite failure.
    const definiteError = new Error(
      error.response?.data?.message ||
      error.message ||
      "Cashfree order creation failed"
    );

    definiteError.code = "CASHFREE_ORDER_CREATION_FAILED";
    definiteError.retryable = false;
    definiteError.outcomeUnknown = false;

    throw definiteError;
  }
}

// ======================================================
// FETCH ORDER STATUS
// Verify status server-side before crediting the wallet.
// ======================================================

async function getCashfreeOrder(orderId) {
  validateCashfreeConfig();

  if (!orderId || !String(orderId).trim()) {
    throw new Error("Cashfree order ID is required");
  }

  const response = await axios.get(
    `${CASHFREE_API_DOMAIN}/orders/${encodeURIComponent(orderId)}`,
    {
      headers: getCashfreeHeaders(),
      timeout: 15000,
    }
  );

  return response.data;
}

// ======================================================
// FETCH PAYMENTS FOR AN ORDER
// ======================================================

async function getCashfreePayments(orderId) {
  validateCashfreeConfig();

  if (!orderId || !String(orderId).trim()) {
    throw new Error("Cashfree order ID is required");
  }

  const response = await axios.get(
    `${CASHFREE_API_DOMAIN}/orders/${encodeURIComponent(orderId)}/payments`,
    {
      headers: getCashfreeHeaders(),
      timeout: 15000,
    }
  );

  if (!Array.isArray(response.data)) {
    throw new Error("Invalid Cashfree payments response");
  }

  return response.data;
}

// ======================================================
// VERIFY WEBHOOK SIGNATURE
// HMAC-SHA256 over timestamp + original raw request body.
// ======================================================

function verifyCashfreeWebhookSignature({
  signature,
  timestamp,
  rawBody,
}) {
  if (
    typeof signature !== "string" ||
    !signature ||
    typeof timestamp !== "string" ||
    !timestamp ||
    typeof rawBody !== "string"
  ) {
    return false;
  }

  if (!CASHFREE_CLIENT_SECRET) {
    throw new Error("CASHFREE_CLIENT_SECRET is not configured");
  }

  const expected = crypto
    .createHmac("sha256", CASHFREE_CLIENT_SECRET)
    .update(timestamp + rawBody, "utf8")
    .digest("base64");

  const expectedBuffer = Buffer.from(expected, "utf8");
  const receivedBuffer = Buffer.from(signature, "utf8");

  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  createCashfreeOrder,
  getCashfreeOrder,
  getCashfreePayments,
  verifyCashfreeWebhookSignature,
  generateCashfreeOrderId,
  generateCashfreeIdempotencyKey,
  formatCashfreeAmount,
};
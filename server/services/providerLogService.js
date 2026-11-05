const mongoose = require("mongoose");
const ProviderLog = require("../models/ProviderLog");

// ======================================================
// SECRET SANITIZATION
// ======================================================

const SENSITIVE_FIELDS = new Set([
  "key",
  "apikey",
  "secret",
  "clientsecret",
  "password",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "auth",
  "credential",
  "credentials",
  "cookie",
  "setcookie",
  "signature",
  "privatekey"
]);

const normalizeFieldName = (key) =>
  String(key).toLowerCase().replace(/[^a-z0-9]/g, "");

const isSensitiveField = (key) => {
  const normalized = normalizeFieldName(key);

  return (
    SENSITIVE_FIELDS.has(normalized) ||
    normalized.endsWith("apikey") ||
    normalized.endsWith("secret") ||
    normalized.endsWith("token") ||
    normalized.endsWith("password")
  );
};

const sanitizeText = (value) => {
  if (typeof value !== "string") return value;

  return value
    .replace(
      /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|authorization|secret)\s*[:=]\s*("[^"]*"|'[^']*'|[^\s,;&]+)/gi,
      "$1=[REDACTED]"
    )
    .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]");
};

const sanitizePayload = (payload) => {
  if (payload === null || payload === undefined) return null;

  if (typeof payload === "string") return sanitizeText(payload);

  if (typeof payload !== "object") return payload;

  if (Array.isArray(payload)) {
    return payload.map(sanitizePayload);
  }

  const sanitized = {};

  for (const [key, value] of Object.entries(payload)) {
    sanitized[key] = isSensitiveField(key)
      ? "[REDACTED]"
      : sanitizePayload(value);
  }

  return sanitized;
};

// ======================================================
// ENDPOINT AND OPERATION NORMALIZATION
// ======================================================

const sanitizeEndpoint = (endpoint) => {
  const value = String(endpoint || "").trim();

  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value.split(/[?#]/, 1)[0];
  }
};

const normalizeOperation = (operation) => {
  const value = String(operation || "unknown")
    .trim()
    .toLowerCase();

  const operationMap = {
    services: "services",
    service: "services",
    create_order: "create_order",
    createorder: "create_order",
    "create-order": "create_order",
    status: "status",
    refill: "refill",
    cancel: "cancel",
    balance: "balance",
    unknown: "unknown"
  };

  return operationMap[value] || "unknown";
};

const nullableNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

// ======================================================
// CREATE PROVIDER LOG
// ======================================================

const createProviderLog = async ({
  providerId,
  orderId = null,
  operation = "unknown",
  method = "POST",
  endpoint,
  requestPayload = null,
  httpStatus = null,
  responsePayload = null,
  success = false,
  errorMessage = null,
  errorCode = null,
  durationMs = null,
  attempt = 1,
  maxAttempts = 1
} = {}) => {
  try {
    if (!providerId || !endpoint) {
      console.error(
        "Provider log skipped: provider ID or endpoint is missing"
      );
      return null;
    }

    // Avoid Mongoose buffering timeouts when disconnected.
    // Logging resumes automatically when MongoDB is connected.
    if (mongoose.connection.readyState !== 1) {
      return null;
    }

    if (!ProviderLog || typeof ProviderLog.create !== "function") {
      console.error(
        "Provider log skipped: ProviderLog model is unavailable"
      );
      return null;
    }

    const status = nullableNumber(httpStatus);
    const duration = nullableNumber(durationMs);
    const attemptNumber = Number(attempt);
    const maxAttemptNumber = Number(maxAttempts);

    const logData = {
      providerId,
      orderId,
      operation: normalizeOperation(operation),
      method: String(method || "POST").toUpperCase(),
      endpoint: sanitizeEndpoint(endpoint),
      requestPayload: sanitizePayload(requestPayload),
      httpStatus:
        status !== null && Number.isInteger(status)
          ? status
          : null,
      responsePayload: sanitizePayload(responsePayload),
      success: Boolean(success),
      errorMessage: errorMessage
        ? sanitizeText(String(errorMessage)).slice(0, 2000)
        : null,
      errorCode: errorCode
        ? sanitizeText(String(errorCode)).slice(0, 200)
        : null,
      durationMs:
        duration !== null && duration >= 0
          ? duration
          : null,
      attempt:
        Number.isInteger(attemptNumber) && attemptNumber > 0
          ? attemptNumber
          : 1,
      maxAttempts:
        Number.isInteger(maxAttemptNumber) &&
        maxAttemptNumber > 0
          ? maxAttemptNumber
          : 1
    };

    return await ProviderLog.create(logData);
  } catch (error) {
    // Do not log the request payload, response body, or full error object.
    console.error(
      "Provider log creation failed:",
      sanitizeText(error?.message || "Unknown logging error")
    );

    return null;
  }
};

// ======================================================
// SUCCESS AND FAILURE HELPERS
// ======================================================

const logProviderSuccess = async (options = {}) =>
  createProviderLog({
    ...options,
    success: true,
    errorMessage: null,
    errorCode: null
  });

const logProviderFailure = async (options = {}) =>
  createProviderLog({
    ...options,
    success: false
  });

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  sanitizePayload,
  createProviderLog,
  logProviderSuccess,
  logProviderFailure,
  normalizeOperation,
  sanitizeEndpoint
};
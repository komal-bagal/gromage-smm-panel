// ======================================================
// PROVIDER LOG SERVICE
// ======================================================

const ProviderLog = require("../models/ProviderLog");

// ======================================================
// SENSITIVE FIELDS
// ======================================================

const SENSITIVE_FIELDS = [
  "key",
  "apiKey",
  "api_key",
  "secret",
  "clientSecret",
  "client_secret",
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "auth",
  "credential",
  "credentials"
];

// ======================================================
// NORMALIZE OPERATION
// ======================================================

const normalizeOperation = (operation) => {
  const value = String(
    operation || "unknown"
  )
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

// ======================================================
// SANITIZE PAYLOAD
// ======================================================

const sanitizePayload = (payload) => {
  if (
    payload === null ||
    payload === undefined
  ) {
    return null;
  }

  if (
    typeof payload !== "object"
  ) {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map(
      (item) =>
        sanitizePayload(item)
    );
  }

  const sanitized = {};

  for (const [key, value] of Object.entries(
    payload
  )) {
    if (
      SENSITIVE_FIELDS.some(
        (field) =>
          field.toLowerCase() ===
          key.toLowerCase()
      )
    ) {
      sanitized[key] =
        "[REDACTED]";

      continue;
    }

    sanitized[key] =
      sanitizePayload(value);
  }

  return sanitized;
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
}) => {
  try {
    if (!providerId) {
      console.error(
        "PROVIDER LOG: providerId is required"
      );

      return null;
    }

    if (!endpoint) {
      console.error(
        "PROVIDER LOG: endpoint is required"
      );

      return null;
    }

    const sanitizedRequest =
      sanitizePayload(
        requestPayload
      );

    const sanitizedResponse =
      sanitizePayload(
        responsePayload
      );

    const log =
      await ProviderLog.create({
        providerId,

        orderId,

        operation:
          normalizeOperation(
            operation
          ),

        method:
          String(
            method || "POST"
          ).toUpperCase(),

        endpoint,

        requestPayload:
          sanitizedRequest,

        httpStatus:
          Number.isFinite(
            Number(httpStatus)
          )
            ? Number(httpStatus)
            : null,

        responsePayload:
          sanitizedResponse,

        success:
          Boolean(success),

        errorMessage:
          errorMessage
            ? String(errorMessage)
            : null,

        errorCode:
          errorCode
            ? String(errorCode)
            : null,

        durationMs:
          Number.isFinite(
            Number(durationMs)
          )
            ? Number(durationMs)
            : null,

        attempt:
          Number.isInteger(
            Number(attempt)
          ) &&
          Number(attempt) > 0
            ? Number(attempt)
            : 1,

        maxAttempts:
          Number.isInteger(
            Number(maxAttempts)
          ) &&
          Number(maxAttempts) > 0
            ? Number(maxAttempts)
            : 1
      });

    return log;

  } catch (error) {
    // --------------------------------------------------
    // LOGGING FAILURE MUST NOT BREAK MAIN FLOW
    // --------------------------------------------------

    console.error(
      "PROVIDER LOG CREATION FAILED:",
      error.message
    );

    return null;
  }
};

// ======================================================
// LOG PROVIDER SUCCESS
// ======================================================

const logProviderSuccess = async ({
  providerId,
  orderId = null,
  operation,
  method = "POST",
  endpoint,
  requestPayload = null,
  httpStatus = 200,
  responsePayload = null,
  durationMs = null,
  attempt = 1,
  maxAttempts = 1
}) => {
  return await createProviderLog({
    providerId,
    orderId,
    operation,
    method,
    endpoint,
    requestPayload,
    httpStatus,
    responsePayload,
    success: true,
    errorMessage: null,
    errorCode: null,
    durationMs,
    attempt,
    maxAttempts
  });
};

// ======================================================
// LOG PROVIDER FAILURE
// ======================================================

const logProviderFailure = async ({
  providerId,
  orderId = null,
  operation,
  method = "POST",
  endpoint,
  requestPayload = null,
  httpStatus = null,
  responsePayload = null,
  errorMessage = null,
  errorCode = null,
  durationMs = null,
  attempt = 1,
  maxAttempts = 1
}) => {
  return await createProviderLog({
    providerId,
    orderId,
    operation,
    method,
    endpoint,
    requestPayload,
    httpStatus,
    responsePayload,
    success: false,
    errorMessage,
    errorCode,
    durationMs,
    attempt,
    maxAttempts
  });
};

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  sanitizePayload,
  createProviderLog,
  logProviderSuccess,
  logProviderFailure
};
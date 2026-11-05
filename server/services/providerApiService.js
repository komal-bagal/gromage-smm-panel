const {
  logProviderSuccess,
  logProviderFailure
} = require("./providerLogService");

// ======================================================
// PROVIDER REQUEST CONFIG
// ======================================================

const DEFAULT_PROVIDER_TIMEOUT_MS = 10000;

// Each provider operation makes only ONE HTTP request per
// application attempt. BullMQ handles status-job retries.

// ======================================================
// UTILITY FUNCTIONS
// ======================================================

const getProviderId = (provider) =>
  provider?._id || provider?.id || null;

// ======================================================
// PARSE RETRY-AFTER HEADER
// ======================================================

const parseRetryAfterMs = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const headerValue = String(value).trim();

  if (!headerValue) {
    return null;
  }

  // Retry-After can be a delay in seconds.
  if (/^\d+(?:\.\d+)?$/.test(headerValue)) {
    const delayMs = Number(headerValue) * 1000;

    return Number.isFinite(delayMs)
      ? delayMs
      : null;
  }

  // Retry-After can also be an HTTP date.
  const retryAt = Date.parse(headerValue);

  if (!Number.isFinite(retryAt)) {
    return null;
  }

  return Math.max(0, retryAt - Date.now());
};

// ======================================================
// FETCH WITH TIMEOUT
// ======================================================

const fetchWithTimeout = async (
  url,
  options = {},
  timeoutMs = DEFAULT_PROVIDER_TIMEOUT_MS
) => {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
};

// ======================================================
// CREATE PROVIDER ERROR
// ======================================================

const createProviderError = (
  message,
  code = "PROVIDER_ERROR",
  retryable = false,
  retryAfterMs = null
) => {
  const error = new Error(message);

  error.code = code;
  error.retryable = retryable;

  if (
    Number.isFinite(retryAfterMs) &&
    retryAfterMs >= 0
  ) {
    error.retryAfterMs = retryAfterMs;
  }

  return error;
};

// ======================================================
// CLASSIFY PROVIDER ERROR
// ======================================================

const classifyProviderError = ({
  statusCode,
  responseData,
  error
}) => {
  const message = String(
    responseData?.error ||
    responseData?.message ||
    responseData?.msg ||
    error?.message ||
    ""
  ).toLowerCase();

  if (
    statusCode === 429 ||
    message.includes("rate limit") ||
    message.includes("too many requests")
  ) {
    return {
      code: "RATE_LIMIT",
      retryable: true
    };
  }

  if (
    statusCode === 408 ||
    statusCode === 504 ||
    error?.name === "AbortError" ||
    error?.code === "ETIMEDOUT" ||
    error?.code === "UND_ERR_CONNECT_TIMEOUT" ||
    message.includes("timeout") ||
    message.includes("timed out")
  ) {
    return {
      code: "PROVIDER_TIMEOUT",
      retryable: true
    };
  }

  if (
    statusCode === 402 ||
    message.includes("insufficient balance") ||
    message.includes("not enough balance") ||
    message.includes("low balance") ||
    message.includes("insufficient funds") ||
    message.includes("not enough funds")
  ) {
    return {
      code: "INSUFFICIENT_PROVIDER_BALANCE",
      retryable: false
    };
  }

  if (
    typeof statusCode === "number" &&
    statusCode >= 400 &&
    statusCode < 500
  ) {
    return {
      code: "PROVIDER_REQUEST_ERROR",
      retryable: false
    };
  }

  if (
    typeof statusCode === "number" &&
    statusCode >= 500
  ) {
    return {
      code: "PROVIDER_SERVER_ERROR",
      retryable: true
    };
  }

  if (
    error?.code === "ECONNRESET" ||
    error?.code === "ECONNREFUSED" ||
    error?.code === "ENOTFOUND" ||
    error?.code === "EAI_AGAIN" ||
    error?.code === "ECONNABORTED" ||
    error?.code === "UND_ERR_CONNECT_TIMEOUT" ||
    error?.name === "TypeError"
  ) {
    return {
      code: "PROVIDER_NETWORK_ERROR",
      retryable: true
    };
  }

  return {
    code: "PROVIDER_ERROR",
    retryable: false
  };
};

// ======================================================
// IS PROVIDER OUTCOME UNCERTAIN
// ======================================================
//
// Returns true when the request may have been received and
// processed by the provider even though we got an error.
// Example: the order was created but the response was lost.
//
// Callers that create orders must NOT fall back to another
// provider or blindly retry when this is true.
//
// Returns false only when the provider definitely did not
// accept the request (never connected, 4xx, or a clear
// business-error body such as { error: "..." }).
//
// ======================================================

const NEVER_CONNECTED_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN"
]);

const isOutcomeUncertain = ({
  responseStatus,
  originalError,
  providerError
}) => {
  // 2xx response but unusable body (e.g. no order ID).
  if (providerError?.code === "INVALID_PROVIDER_RESPONSE") {
    return true;
  }

  // No HTTP response at all: timeout, abort, reset, etc.
  if (responseStatus === null || responseStatus === undefined) {
    const errorCode =
      originalError?.code ||
      originalError?.cause?.code;

    // Connection never established: provider saw nothing.
    if (NEVER_CONNECTED_CODES.has(errorCode)) {
      return false;
    }

    return true;
  }

  // Server error or gateway timeout: request may have been
  // processed before the failure.
  if (
    responseStatus >= 500 ||
    responseStatus === 408
  ) {
    return true;
  }

  // 2xx status, but reading/parsing the body failed with a
  // raw (non-provider) error, e.g. timeout while reading.
  const isRawError =
    typeof originalError?.retryable !== "boolean";

  if (
    responseStatus >= 200 &&
    responseStatus < 300 &&
    isRawError
  ) {
    return true;
  }

  // 4xx or business-error body: definite rejection.
  return false;
};

// ======================================================
// VALIDATE PROVIDER
// ======================================================

const validateProvider = ({
  provider,
  providerOrderId = null,
  requireOrderId = false
}) => {
  if (!provider) {
    throw createProviderError(
      "Provider is required",
      "PROVIDER_NOT_FOUND"
    );
  }

  if (!provider.apiUrl) {
    throw createProviderError(
      "Provider API URL is missing",
      "PROVIDER_API_URL_MISSING"
    );
  }

  if (!provider.apiKey) {
    throw createProviderError(
      "Provider API key is missing",
      "PROVIDER_API_KEY_MISSING"
    );
  }

  if (requireOrderId && !providerOrderId) {
    throw createProviderError(
      "Provider order ID is required",
      "PROVIDER_ORDER_ID_MISSING"
    );
  }

  const providerId = getProviderId(provider);

  if (!providerId) {
    throw createProviderError(
      "Provider ID is missing",
      "PROVIDER_ID_MISSING"
    );
  }

  return providerId;
};

// ======================================================
// PARSE PROVIDER RESPONSE
// ======================================================

const parseProviderResponse = async (response) => {
  const responseText = await response.text();

  if (!responseText) {
    return {};
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return {
      raw: responseText
    };
  }
};

// ======================================================
// PROVIDER BUSINESS ERROR CHECK
// ======================================================

const hasProviderBusinessError = (responseData) =>
  Boolean(responseData?.error || responseData?.errors);

// ======================================================
// GET PROVIDER ERROR MESSAGE
// ======================================================

const getProviderErrorMessage = (responseData, fallback) => {
  if (typeof responseData?.error === "string") {
    return responseData.error;
  }

  if (typeof responseData?.message === "string") {
    return responseData.message;
  }

  if (typeof responseData?.msg === "string") {
    return responseData.msg;
  }

  if (Array.isArray(responseData?.errors)) {
    return responseData.errors
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        return (
          item?.message ||
          item?.error ||
          JSON.stringify(item)
        );
      })
      .join(", ");
  }

  return fallback;
};

// ======================================================
// CENTRALIZED FAILURE LOGGING
// ======================================================
//
// Logging must never replace the original provider error.
//
// ======================================================

const recordProviderFailure = async ({
  error,
  providerId,
  orderId,
  operation,
  endpoint,
  requestPayload,
  httpStatus = null,
  responsePayload = null,
  startedAt,
  attempt,
  maxAttempts
}) => {
  if (error.providerFailureLogged) {
    return;
  }

  // Mark first so a logging failure is never retried in a loop.
  error.providerFailureLogged = true;

  try {
    await logProviderFailure({
      providerId,
      orderId,
      operation,
      method: "POST",
      endpoint,
      requestPayload,
      httpStatus,
      responsePayload,
      errorMessage: error.message,
      errorCode: error.code || "PROVIDER_ERROR",
      durationMs: Date.now() - startedAt,
      attempt,
      maxAttempts
    });
  } catch (logError) {
    console.error(
      "Failed to write provider failure log:",
      logError.message
    );
  }
};

// ======================================================
// CENTRALIZED PROVIDER REQUEST
// ======================================================

const executeProviderRequest = async ({
  provider,
  providerOrderId = null,
  orderId = null,
  operation,
  action,
  endpointPath,
  additionalFields = {},
  validateResponse
}) => {
  const providerId = validateProvider({
    provider,
    providerOrderId,
    requireOrderId: Boolean(providerOrderId)
  });

  const baseUrl = String(provider.apiUrl).replace(/\/+$/, "");
  const url = `${baseUrl}${endpointPath}`;

  // One HTTP request per invocation.
  // BullMQ is responsible for retrying status jobs.
  const attempt = 1;
  const maxAttempts = 1;
  const startedAt = Date.now();

  const requestPayload = {
    action,
    ...additionalFields
  };

  if (providerOrderId) {
    requestPayload.order = providerOrderId;
  }

  let responseStatus = null;
  let responseData = null;

  try {
    const formData = new URLSearchParams();

    formData.append("key", provider.apiKey);
    formData.append("action", action);

    if (providerOrderId) {
      formData.append("order", providerOrderId);
    }

    Object.entries(additionalFields).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });

    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData.toString()
    });

    responseStatus = response.status;
    responseData = await parseProviderResponse(response);

    if (!response.ok) {
      const classification = classifyProviderError({
        statusCode: response.status,
        responseData
      });

      const retryAfterMs =
        response.status === 429
          ? parseRetryAfterMs(
              response.headers?.get("retry-after")
            )
          : null;

      throw createProviderError(
        getProviderErrorMessage(
          responseData,
          `Provider returned HTTP ${response.status}`
        ),
        classification.code,
        classification.retryable,
        retryAfterMs
      );
    }

    if (hasProviderBusinessError(responseData)) {
      const classification = classifyProviderError({
        statusCode: response.status,
        responseData
      });

      throw createProviderError(
        getProviderErrorMessage(
          responseData,
          "Provider returned an error"
        ),
        classification.code,
        classification.retryable
      );
    }

    if (typeof validateResponse === "function") {
      const validationResult = validateResponse(responseData);

      if (validationResult !== true) {
        throw createProviderError(
          typeof validationResult === "string"
            ? validationResult
            : "Invalid provider response",
          "INVALID_PROVIDER_RESPONSE",
          false
        );
      }
    }

    // Logging is best-effort. A logging failure must never turn
    // an accepted provider request into a failed one.
    try {
      await logProviderSuccess({
        providerId,
        orderId,
        operation,
        method: "POST",
        endpoint: url,
        requestPayload,
        httpStatus: response.status,
        responsePayload: responseData,
        durationMs: Date.now() - startedAt,
        attempt,
        maxAttempts
      });
    } catch (logError) {
      console.error(
        "Failed to write provider success log:",
        logError.message
      );
    }

    return responseData;
  } catch (error) {
    let providerError;

    if (typeof error?.retryable === "boolean") {
      providerError = error;
    } else {
      const classification = classifyProviderError({
        statusCode: responseStatus,
        responseData,
        error
      });

      providerError = createProviderError(
        error?.message ||
          `Provider ${operation} request failed`,
        classification.code,
        classification.retryable
      );
    }

    // Tell callers whether the provider may have accepted the
    // request even though we received an error.
    if (providerError.outcomeUncertain === undefined) {
      providerError.outcomeUncertain = isOutcomeUncertain({
        responseStatus,
        originalError: error,
        providerError
      });
    }

    await recordProviderFailure({
      error: providerError,
      providerId,
      orderId,
      operation,
      endpoint: url,
      requestPayload,
      httpStatus: responseStatus,
      responsePayload: responseData,
      startedAt,
      attempt,
      maxAttempts
    });

    throw providerError;
  }
};

// ======================================================
// CREATE PROVIDER ORDER
// ======================================================

const createProviderOrder = async ({
  provider,
  orderId,
  service,
  link,
  quantity,
  runs,
  interval
}) => {
  if (!service) {
    throw createProviderError(
      "Provider service ID is required",
      "PROVIDER_SERVICE_ID_MISSING"
    );
  }

  if (!link) {
    throw createProviderError(
      "Provider order link is required",
      "PROVIDER_LINK_MISSING"
    );
  }

  if (quantity === undefined || quantity === null) {
    throw createProviderError(
      "Provider order quantity is required",
      "PROVIDER_QUANTITY_MISSING"
    );
  }

  const additionalFields = {
    service,
    link,
    quantity
  };

  if (runs !== undefined) {
    additionalFields.runs = runs;
  }

  if (interval !== undefined) {
    additionalFields.interval = interval;
  }

  const responseData = await executeProviderRequest({
    provider,
    providerOrderId: null,
    orderId,
    operation: "create_order",
    action: "add",
    endpointPath: "/order/add",
    additionalFields,
    validateResponse: (data) => {
      const providerOrderId =
        data?.order || data?.orderId || data?.id;

      return providerOrderId
        ? true
        : "Invalid provider create order response";
    }
  });

  return {
    providerOrderId:
      responseData.order ||
      responseData.orderId ||
      responseData.id,
    providerResponse: responseData
  };
};

// ======================================================
// FETCH PROVIDER ORDER STATUS
// ======================================================

const fetchProviderOrderStatus = async ({
  provider,
  providerOrderId,
  orderId
}) => {
  const responseData = await executeProviderRequest({
    provider,
    providerOrderId,
    orderId,
    operation: "STATUS",
    action: "status",
    endpointPath: "/order/status",
    validateResponse: (data) =>
      data?.status
        ? true
        : "Invalid provider status response"
  });

  const startCount =
    responseData.start_count !== undefined
      ? Number(responseData.start_count)
      : null;

  const remains =
    responseData.remains !== undefined
      ? Number(responseData.remains)
      : null;

  return {
    providerOrderId,
    status: responseData.status,
    startCount: Number.isFinite(startCount) ? startCount : null,
    remains: Number.isFinite(remains) ? remains : null,
    providerResponse: responseData
  };
};

// ======================================================
// CANCEL PROVIDER ORDER
// ======================================================

const cancelProviderOrder = async ({
  provider,
  providerOrderId,
  orderId
}) => {
  const responseData = await executeProviderRequest({
    provider,
    providerOrderId,
    orderId,
    operation: "CANCEL",
    action: "cancel",
    endpointPath: "/order/cancel",
    validateResponse: (data) =>
      data?.order
        ? true
        : "Invalid provider cancel response"
  });

  return {
    providerOrderId,
    status: responseData.status,
    providerResponse: responseData
  };
};

// ======================================================
// REFILL PROVIDER ORDER
// ======================================================

const refillProviderOrder = async ({
  provider,
  providerOrderId,
  orderId
}) => {
  const responseData = await executeProviderRequest({
    provider,
    providerOrderId,
    orderId,
    operation: "REFILL",
    action: "refill",
    endpointPath: "/order/refill",
    validateResponse: (data) => {
      const refillId =
        data?.refill || data?.refillId || data?.id;

      return refillId
        ? true
        : "Invalid provider refill response";
    }
  });

  return {
    providerOrderId,
    refillId:
      responseData.refill ||
      responseData.refillId ||
      responseData.id,
    status: responseData.status,
    providerResponse: responseData
  };
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  createProviderOrder,
  fetchProviderOrderStatus,
  cancelProviderOrder,
  refillProviderOrder,
  classifyProviderError,
  fetchWithTimeout,
  isOutcomeUncertain
};
const {
  logProviderSuccess,
  logProviderFailure
} = require("./providerLogService");

// ======================================================
// PROVIDER REQUEST CONFIG
// ======================================================

const DEFAULT_PROVIDER_TIMEOUT_MS = 10000;
const DEFAULT_PROVIDER_MAX_ATTEMPTS = 3;
const DEFAULT_PROVIDER_RETRY_DELAY_MS = 1000;
const MAX_PROVIDER_RETRY_DELAY_MS = 5000;


// ======================================================
// UTILITY FUNCTIONS
// ======================================================

const getDurationMs = (startedAt) => {
  return Date.now() - startedAt;
};


const sleep = (ms) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};


const getRetryDelayMs = (attempt) => {
  const delay =
    DEFAULT_PROVIDER_RETRY_DELAY_MS *
    Math.pow(2, Math.max(attempt - 1, 0));

  return Math.min(
    delay,
    MAX_PROVIDER_RETRY_DELAY_MS
  );
};


const getProviderId = (provider) => {
  return (
    provider?._id ||
    provider?.id ||
    null
  );
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
  retryable = false
) => {
  const error = new Error(message);

  error.code = code;
  error.retryable = retryable;

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


  // RATE LIMIT
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


  // TIMEOUT
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


  // PROVIDER BALANCE
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


  // CLIENT ERROR
  if (
    statusCode >= 400 &&
    statusCode < 500
  ) {
    return {
      code: "PROVIDER_REQUEST_ERROR",
      retryable: false
    };
  }


  // SERVER ERROR
  if (statusCode >= 500) {
    return {
      code: "PROVIDER_SERVER_ERROR",
      retryable: true
    };
  }


  // NETWORK ERROR
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


  // GENERIC ERROR
  return {
    code: "PROVIDER_ERROR",
    retryable: false
  };
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


  if (
    requireOrderId &&
    !providerOrderId
  ) {
    throw createProviderError(
      "Provider order ID is required",
      "PROVIDER_ORDER_ID_MISSING"
    );
  }


  const providerId =
    getProviderId(provider);


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
  } catch (error) {
    return {
      raw: responseText
    };
  }
};


// ======================================================
// PROVIDER BUSINESS ERROR CHECK
// ======================================================

const hasProviderBusinessError = (responseData) => {
  return Boolean(
    responseData?.error ||
    responseData?.errors
  );
};


// ======================================================
// GET PROVIDER ERROR MESSAGE
// ======================================================

const getProviderErrorMessage = (
  responseData,
  fallback
) => {
  if (
    typeof responseData?.error === "string"
  ) {
    return responseData.error;
  }


  if (
    typeof responseData?.message === "string"
  ) {
    return responseData.message;
  }


  if (
    typeof responseData?.msg === "string"
  ) {
    return responseData.msg;
  }


  if (
    Array.isArray(responseData?.errors)
  ) {
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
// PROVIDER REQUEST
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


  const baseUrl = String(
    provider.apiUrl
  ).replace(/\/+$/, "");


  const url =
    `${baseUrl}${endpointPath}`;


  const maxAttempts =
    DEFAULT_PROVIDER_MAX_ATTEMPTS;


  let lastError;


  // ====================================================
  // RETRY LOOP
  // ====================================================

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {

    const startedAt = Date.now();


    // --------------------------------------------------
    // LOG-SAFE REQUEST PAYLOAD
    // --------------------------------------------------

    const requestPayload = {
      action,
      ...additionalFields
    };


    if (providerOrderId) {
      requestPayload.order =
        providerOrderId;
    }


    try {

      // ------------------------------------------------
      // FORM DATA
      // ------------------------------------------------

      const formData =
        new URLSearchParams();


      formData.append(
        "key",
        provider.apiKey
      );


      formData.append(
        "action",
        action
      );


      if (providerOrderId) {
        formData.append(
          "order",
          providerOrderId
        );
      }


      Object.entries(
        additionalFields
      ).forEach(([key, value]) => {

        if (
          value !== undefined &&
          value !== null
        ) {
          formData.append(
            key,
            String(value)
          );
        }
      });


      // ------------------------------------------------
      // SEND REQUEST
      // ------------------------------------------------

      const response =
        await fetchWithTimeout(
          url,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded"
            },

            body:
              formData.toString()
          }
        );


      // ------------------------------------------------
      // PARSE RESPONSE
      // ------------------------------------------------

      const responseData =
        await parseProviderResponse(
          response
        );


      // ------------------------------------------------
      // HTTP ERROR
      // ------------------------------------------------

      if (!response.ok) {

        const classification =
          classifyProviderError({
            statusCode:
              response.status,

            responseData
          });


        const providerError =
          createProviderError(
            getProviderErrorMessage(
              responseData,
              `Provider returned HTTP ${response.status}`
            ),
            classification.code,
            classification.retryable
          );


        lastError =
          providerError;


        await logProviderFailure({
          providerId,
          orderId,
          operation,
          method: "POST",
          endpoint: url,
          requestPayload,

          httpStatus:
            response.status,

          responsePayload:
            responseData,

          errorMessage:
            providerError.message,

          errorCode:
            providerError.code,

          durationMs:
            getDurationMs(startedAt),

          attempt,
          maxAttempts
        });


        if (
          providerError.retryable &&
          attempt < maxAttempts
        ) {
          await sleep(
            getRetryDelayMs(attempt)
          );

          continue;
        }


        throw providerError;
      }


      // ------------------------------------------------
      // BUSINESS ERROR
      // ------------------------------------------------

      if (
        hasProviderBusinessError(
          responseData
        )
      ) {

        const classification =
          classifyProviderError({
            statusCode:
              response.status,

            responseData
          });


        const providerError =
          createProviderError(
            getProviderErrorMessage(
              responseData,
              "Provider returned an error"
            ),
            classification.code,
            classification.retryable
          );


        lastError =
          providerError;


        await logProviderFailure({
          providerId,
          orderId,
          operation,
          method: "POST",
          endpoint: url,
          requestPayload,

          httpStatus:
            response.status,

          responsePayload:
            responseData,

          errorMessage:
            providerError.message,

          errorCode:
            providerError.code,

          durationMs:
            getDurationMs(startedAt),

          attempt,
          maxAttempts
        });


        if (
          providerError.retryable &&
          attempt < maxAttempts
        ) {
          await sleep(
            getRetryDelayMs(attempt)
          );

          continue;
        }


        throw providerError;
      }


      // ------------------------------------------------
      // RESPONSE VALIDATION
      // ------------------------------------------------

      if (
        typeof validateResponse === "function"
      ) {

        const validationResult =
          validateResponse(
            responseData
          );


        if (
          validationResult !== true
        ) {

          const providerError =
            createProviderError(
              validationResult ||
                "Invalid provider response",

              "INVALID_PROVIDER_RESPONSE",

              false
            );


          await logProviderFailure({
            providerId,
            orderId,
            operation,
            method: "POST",
            endpoint: url,
            requestPayload,

            httpStatus:
              response.status,

            responsePayload:
              responseData,

            errorMessage:
              providerError.message,

            errorCode:
              providerError.code,

            durationMs:
              getDurationMs(startedAt),

            attempt,
            maxAttempts
          });


          throw providerError;
        }
      }


      // ------------------------------------------------
      // SUCCESS LOG
      // ------------------------------------------------

      await logProviderSuccess({
        providerId,
        orderId,
        operation,
        method: "POST",
        endpoint: url,
        requestPayload,

        httpStatus:
          response.status,

        responsePayload:
          responseData,

        durationMs:
          getDurationMs(startedAt),

        attempt,
        maxAttempts
      });


      return responseData;

    } catch (error) {

      lastError =
        error;


      const classification =
        classifyProviderError({
          error
        });


      const providerError =
        error?.code
          ? error
          : createProviderError(
              error?.message ||
                `Provider ${operation.toLowerCase()} request failed`,

              classification.code,

              classification.retryable
            );


      const alreadyLoggedCodes = [
        "RATE_LIMIT",
        "PROVIDER_TIMEOUT",
        "INSUFFICIENT_PROVIDER_BALANCE",
        "PROVIDER_REQUEST_ERROR",
        "PROVIDER_SERVER_ERROR",
        "PROVIDER_NETWORK_ERROR",
        "INVALID_PROVIDER_RESPONSE"
      ];


      const alreadyLogged =
        alreadyLoggedCodes.includes(
          providerError.code
        );


      if (!alreadyLogged) {

        await logProviderFailure({
          providerId,
          orderId,
          operation,
          method: "POST",
          endpoint: url,
          requestPayload,

          httpStatus: null,

          responsePayload: null,

          errorMessage:
            providerError.message,

          errorCode:
            providerError.code,

          durationMs:
            getDurationMs(startedAt),

          attempt,
          maxAttempts
        });
      }


      if (
        providerError.retryable &&
        attempt < maxAttempts
      ) {

        await sleep(
          getRetryDelayMs(attempt)
        );

        continue;
      }


      throw providerError;
    }
  }


  throw (
    lastError ||
    createProviderError(
      "Provider request failed"
    )
  );
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


  if (
    quantity === undefined ||
    quantity === null
  ) {
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


  const responseData =
    await executeProviderRequest({
      provider,
      providerOrderId: null,
      orderId,

      operation: "CREATE",

      action: "add",

      endpointPath: "/order/add",

      additionalFields,

      validateResponse: (data) => {

        const providerOrderId =
          data?.order ||
          data?.orderId ||
          data?.id;


        if (!providerOrderId) {
          return (
            "Invalid provider create order response"
          );
        }


        return true;
      }
    });


  const providerOrderId =
    responseData?.order ||
    responseData?.orderId ||
    responseData?.id;


  return {
    providerOrderId,
    providerResponse:
      responseData
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

  const responseData =
    await executeProviderRequest({
      provider,
      providerOrderId,
      orderId,

      operation: "STATUS",

      action: "status",

      endpointPath: "/order/status",

      validateResponse: (data) => {

        if (!data?.status) {
          return (
            "Invalid provider status response"
          );
        }

        return true;
      }
    });


  const startCount =
    responseData.start_count !== undefined
      ? Number(
          responseData.start_count
        )
      : null;


  const remains =
    responseData.remains !== undefined
      ? Number(
          responseData.remains
        )
      : null;


  return {
    providerOrderId,

    status:
      responseData.status,

    startCount:
      Number.isFinite(startCount)
        ? startCount
        : null,

    remains:
      Number.isFinite(remains)
        ? remains
        : null,

    providerResponse:
      responseData
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

  const responseData =
    await executeProviderRequest({
      provider,
      providerOrderId,
      orderId,

      operation: "CANCEL",

      action: "cancel",

      endpointPath: "/order/cancel",

      validateResponse: (data) => {

        if (!data?.order) {
          return (
            "Invalid provider cancel response"
          );
        }

        return true;
      }
    });


  return {
    providerOrderId,

    status:
      responseData.status,

    providerResponse:
      responseData
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

  const responseData =
    await executeProviderRequest({
      provider,
      providerOrderId,
      orderId,

      operation: "REFILL",

      action: "refill",

      endpointPath: "/order/refill",

      validateResponse: (data) => {

        const refillId =
          data?.refill ||
          data?.refillId ||
          data?.id;


        if (!refillId) {
          return (
            "Invalid provider refill response"
          );
        }


        return true;
      }
    });


  const refillId =
    responseData?.refill ||
    responseData?.refillId ||
    responseData?.id;


  return {
    providerOrderId,

    refillId,

    status:
      responseData.status,

    providerResponse:
      responseData
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
  fetchWithTimeout
};
// ======================================================
// PROVIDER CONTROLLER
// ======================================================

const Provider = require("../models/Provider");
const Service = require("../models/Service");
const Category = require("../models/Category");
const Order = require("../models/Order");

const {
  logProviderSuccess,
  logProviderFailure
} = require("../services/providerLogService");

// ======================================================
// CONSTANTS
// ======================================================

const PROVIDER_REQUEST_TIMEOUT_MS = 15000;
const MAX_PROVIDER_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_IMPORTED_SERVICES = 10000;

// ======================================================
// HELPERS
// ======================================================

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const normalizeProviderUrl = (value) => {
  if (!isNonEmptyString(value)) {
    throw new Error("Provider API URL is required");
  }

  const url = new URL(value.trim());

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Provider API URL must use HTTP or HTTPS");
  }

  if (!url.hostname) {
    throw new Error("Invalid provider API URL");
  }

  return url.toString().replace(/\/+$/, "");
};

const sanitizeText = (value, maxLength = 5000) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
};

const sanitizeProviderResponse = (provider) => {
  const response = provider.toObject();

  delete response.apiKey;

  return response;
};

const createAbortSignal = () => {
  return AbortSignal.timeout(
    PROVIDER_REQUEST_TIMEOUT_MS
  );
};

const readResponseTextSafely = async (response) => {
  const contentLength =
    response.headers.get("content-length");

  if (
    contentLength &&
    Number(contentLength) >
      MAX_PROVIDER_RESPONSE_BYTES
  ) {
    throw new Error(
      "Provider response is too large"
    );
  }

  const text = await response.text();

  if (
    Buffer.byteLength(text, "utf8") >
    MAX_PROVIDER_RESPONSE_BYTES
  ) {
    throw new Error(
      "Provider response is too large"
    );
  }

  return text;
};

const parseProviderJson = (responseText) => {
  try {
    return JSON.parse(responseText);
  } catch {
    return null;
  }
};

const buildProviderRequest = ({
  apiKey,
  action
}) => {
  const params =
    new URLSearchParams();

  params.append("key", apiKey);
  params.append("action", action);

  return params.toString();
};

const validateProviderId = (providerId) => {
  return (
    typeof providerId === "string" &&
    /^[a-fA-F0-9]{24}$/.test(providerId)
  );
};

// ======================================================
// CREATE PROVIDER
// ======================================================

const createProvider = async (req, res) => {
  try {
    const {
      name,
      apiUrl,
      apiKey,
      status,
      description,
      sortOrder,
      priority,
      isDefault
    } = req.body || {};

    if (!isNonEmptyString(name)) {
      return res.status(400).json({
        message: "Provider name is required"
      });
    }

    if (!isNonEmptyString(apiUrl)) {
      return res.status(400).json({
        message: "Provider API URL is required"
      });
    }

    if (!isNonEmptyString(apiKey)) {
      return res.status(400).json({
        message: "Provider API key is required"
      });
    }

    const normalizedName =
      name.trim().slice(0, 200);

    const normalizedApiKey =
      apiKey.trim();

    if (normalizedApiKey.length > 1000) {
      return res.status(400).json({
        message: "Provider API key is too long"
      });
    }

    let normalizedApiUrl;

    try {
      normalizedApiUrl =
        normalizeProviderUrl(apiUrl);
    } catch {
      return res.status(400).json({
        message: "Invalid provider API URL"
      });
    }

    const existingProvider =
      await Provider.findOne({
        name: normalizedName
      });

    if (existingProvider) {
      return res.status(409).json({
        message: "Provider already exists"
      });
    }

    const selectedStatus =
      status || "active";

    if (
      !["active", "inactive"].includes(
        selectedStatus
      )
    ) {
      return res.status(400).json({
        message: "Invalid provider status"
      });
    }

    const numericSortOrder =
      sortOrder !== undefined
        ? Number(sortOrder)
        : 0;

    if (
      !Number.isFinite(numericSortOrder) ||
      numericSortOrder < 0 ||
      numericSortOrder > 1000000
    ) {
      return res.status(400).json({
        message:
          "Sort order must be a valid non-negative number"
      });
    }

    const numericPriority =
      priority !== undefined
        ? Number(priority)
        : 1;

    if (
      !Number.isInteger(numericPriority) ||
      numericPriority < 1 ||
      numericPriority > 100000
    ) {
      return res.status(400).json({
        message:
          "Priority must be a positive whole number"
      });
    }

    const provider =
      await Provider.create({
        name: normalizedName,

        apiUrl:
          normalizedApiUrl,

        apiKey:
          normalizedApiKey,

        status:
          selectedStatus,

        description:
          sanitizeText(description, 5000),

        sortOrder:
          numericSortOrder,

        priority:
          numericPriority,

        isDefault:
          Boolean(isDefault)
      });

    return res.status(201).json({
      message:
        "Provider created successfully",

      provider:
        sanitizeProviderResponse(provider)
    });

  } catch (error) {
    console.error(
      "CREATE PROVIDER ERROR:",
      error
    );

    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "Provider already exists"
      });
    }

    return res.status(500).json({
      message:
        "Server error"
    });
  }
};

// ======================================================
// GET ALL PROVIDERS
// ======================================================

const getAllProviders = async (req, res) => {
  try {
    const providers =
      await Provider.find()
        .select("-apiKey")
        .sort({
          priority: 1,
          sortOrder: 1,
          createdAt: -1
        })
        .lean();

    return res.status(200).json({
      message:
        "Providers fetched successfully",

      count:
        providers.length,

      providers
    });

  } catch (error) {
    console.error(
      "GET ALL PROVIDERS ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Server error"
    });
  }
};

// ======================================================
// GET PROVIDER BY ID
// ======================================================

const getProviderById = async (req, res) => {
  try {
    const {
      providerId
    } = req.params;

    if (!validateProviderId(providerId)) {
      return res.status(400).json({
        message:
          "Invalid provider ID"
      });
    }

    const provider =
      await Provider.findById(
        providerId
      )
        .select("-apiKey")
        .lean();

    if (!provider) {
      return res.status(404).json({
        message:
          "Provider not found"
      });
    }

    return res.status(200).json({
      message:
        "Provider fetched successfully",

      provider
    });

  } catch (error) {
    console.error(
      "GET PROVIDER BY ID ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Server error"
    });
  }
};

// ======================================================
// UPDATE PROVIDER
// ======================================================

const updateProvider = async (req, res) => {
  try {
    const {
      providerId
    } = req.params;

    if (!validateProviderId(providerId)) {
      return res.status(400).json({
        message:
          "Invalid provider ID"
      });
    }

    const {
      name,
      apiUrl,
      apiKey,
      status,
      description,
      sortOrder,
      priority,
      isDefault
    } = req.body || {};

    const provider =
      await Provider.findById(
        providerId
      ).select("+apiKey");

    if (!provider) {
      return res.status(404).json({
        message:
          "Provider not found"
      });
    }

    // --------------------------------------------------
    // NAME
    // --------------------------------------------------

    if (name !== undefined) {
      if (!isNonEmptyString(name)) {
        return res.status(400).json({
          message:
            "Provider name cannot be empty"
        });
      }

      const normalizedName =
        name.trim().slice(0, 200);

      const duplicateProvider =
        await Provider.findOne({
          name:
            normalizedName,

          _id: {
            $ne:
              provider._id
          }
        });

      if (duplicateProvider) {
        return res.status(409).json({
          message:
            "Provider already exists"
        });
      }

      provider.name =
        normalizedName;
    }

    // --------------------------------------------------
    // API URL
    // --------------------------------------------------

    if (apiUrl !== undefined) {
      if (!isNonEmptyString(apiUrl)) {
        return res.status(400).json({
          message:
            "Provider API URL cannot be empty"
        });
      }

      try {
        provider.apiUrl =
          normalizeProviderUrl(apiUrl);
      } catch {
        return res.status(400).json({
          message:
            "Invalid provider API URL"
        });
      }
    }

    // --------------------------------------------------
    // API KEY
    // --------------------------------------------------

    if (apiKey !== undefined) {
      if (!isNonEmptyString(apiKey)) {
        return res.status(400).json({
          message:
            "Provider API key cannot be empty"
        });
      }

      const normalizedApiKey =
        apiKey.trim();

      if (normalizedApiKey.length > 1000) {
        return res.status(400).json({
          message:
            "Provider API key is too long"
        });
      }

      provider.apiKey =
        normalizedApiKey;
    }

    // --------------------------------------------------
    // STATUS
    // --------------------------------------------------

    if (status !== undefined) {
      if (
        !["active", "inactive"].includes(
          status
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid provider status"
        });
      }

      provider.status =
        status;
    }

    // --------------------------------------------------
    // DESCRIPTION
    // --------------------------------------------------

    if (description !== undefined) {
      provider.description =
        sanitizeText(
          description,
          5000
        );
    }

    // --------------------------------------------------
    // SORT ORDER
    // --------------------------------------------------

    if (sortOrder !== undefined) {
      const numericSortOrder =
        Number(sortOrder);

      if (
        !Number.isFinite(
          numericSortOrder
        ) ||
        numericSortOrder < 0 ||
        numericSortOrder > 1000000
      ) {
        return res.status(400).json({
          message:
            "Sort order must be a valid non-negative number"
        });
      }

      provider.sortOrder =
        numericSortOrder;
    }

    // --------------------------------------------------
    // PRIORITY
    // --------------------------------------------------

    if (priority !== undefined) {
      const numericPriority =
        Number(priority);

      if (
        !Number.isInteger(
          numericPriority
        ) ||
        numericPriority < 1 ||
        numericPriority > 100000
      ) {
        return res.status(400).json({
          message:
            "Priority must be a positive whole number"
        });
      }

      provider.priority =
        numericPriority;
    }

    // --------------------------------------------------
    // DEFAULT
    // --------------------------------------------------

    if (isDefault !== undefined) {
      provider.isDefault =
        Boolean(isDefault);
    }

    await provider.save();

    return res.status(200).json({
      message:
        "Provider updated successfully",

      provider:
        sanitizeProviderResponse(provider)
    });

  } catch (error) {
    console.error(
      "UPDATE PROVIDER ERROR:",
      error
    );

    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "Provider already exists"
      });
    }

    return res.status(500).json({
      message:
        "Server error"
    });
  }
};

// ======================================================
// UPDATE PROVIDER PRIORITY
// ======================================================

const updateProviderPriority = async (req, res) => {
  try {
    const {
      providerId
    } = req.params;

    if (!validateProviderId(providerId)) {
      return res.status(400).json({
        message:
          "Invalid provider ID"
      });
    }

    const {
      priority
    } = req.body || {};

    if (
      priority === undefined ||
      priority === null ||
      priority === ""
    ) {
      return res.status(400).json({
        message:
          "Priority is required"
      });
    }

    const numericPriority =
      Number(priority);

    if (
      !Number.isInteger(
        numericPriority
      ) ||
      numericPriority < 1 ||
      numericPriority > 100000
    ) {
      return res.status(400).json({
        message:
          "Priority must be a positive whole number"
      });
    }

    const provider =
      await Provider.findById(
        providerId
      );

    if (!provider) {
      return res.status(404).json({
        message:
          "Provider not found"
      });
    }

    provider.priority =
      numericPriority;

    await provider.save();

    return res.status(200).json({
      success: true,

      message:
        "Provider priority updated successfully",

      provider:
        sanitizeProviderResponse(provider)
    });

  } catch (error) {
    console.error(
      "UPDATE PROVIDER PRIORITY ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Server error"
    });
  }
};

// ======================================================
// DELETE PROVIDER
// ======================================================

const deleteProvider = async (req, res) => {
  try {
    const {
      providerId
    } = req.params;

    if (!validateProviderId(providerId)) {
      return res.status(400).json({
        message:
          "Invalid provider ID"
      });
    }

    const provider =
      await Provider.findById(
        providerId
      );

    if (!provider) {
      return res.status(404).json({
        message:
          "Provider not found"
      });
    }

    // --------------------------------------------------
    // PROTECT REFERENCED SERVICES
    // --------------------------------------------------

    const serviceCount =
      await Service.countDocuments({
        providerId:
          provider._id
      });

    if (serviceCount > 0) {
      return res.status(409).json({
        message:
          "Provider cannot be deleted because services are still linked to it",
        linkedServices:
          serviceCount
      });
    }

    // --------------------------------------------------
    // PROTECT REFERENCED ORDERS
    // --------------------------------------------------

    const orderCount =
      await Order.countDocuments({
        providerId:
          provider._id
      });

    if (orderCount > 0) {
      return res.status(409).json({
        message:
          "Provider cannot be deleted because orders are still linked to it",
        linkedOrders:
          orderCount
      });
    }

    await Provider.findByIdAndDelete(
      provider._id
    );

    return res.status(200).json({
      message:
        "Provider deleted successfully"
    });

  } catch (error) {
    console.error(
      "DELETE PROVIDER ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Server error"
    });
  }
};

// ======================================================
// UPDATE PROVIDER STATUS
// ======================================================

const updateProviderStatus = async (req, res) => {
  try {
    const {
      providerId
    } = req.params;

    if (!validateProviderId(providerId)) {
      return res.status(400).json({
        message:
          "Invalid provider ID"
      });
    }

    const {
      status
    } = req.body || {};

    if (
      !["active", "inactive"].includes(
        status
      )
    ) {
      return res.status(400).json({
        message:
          "Status must be either active or inactive"
      });
    }

    const provider =
      await Provider.findById(
        providerId
      );

    if (!provider) {
      return res.status(404).json({
        message:
          "Provider not found"
      });
    }

    provider.status =
      status;

    await provider.save();

    return res.status(200).json({
      message:
        "Provider status updated successfully",

      provider:
        sanitizeProviderResponse(provider)
    });

  } catch (error) {
    console.error(
      "UPDATE PROVIDER STATUS ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Server error"
    });
  }
};

// ======================================================
// TEST PROVIDER CONNECTION
// ======================================================

const testProviderConnection = async (req, res) => {
  try {
    const {
      providerId
    } = req.params;

    if (!validateProviderId(providerId)) {
      return res.status(400).json({
        message:
          "Invalid provider ID"
      });
    }

    const provider =
      await Provider.findById(
        providerId
      ).select("+apiKey");

    if (!provider) {
      return res.status(404).json({
        message:
          "Provider not found"
      });
    }

    if (provider.status !== "active") {
      return res.status(400).json({
        message:
          "Provider is inactive"
      });
    }

    if (!provider.apiUrl) {
      return res.status(400).json({
        message:
          "Provider API URL is not configured"
      });
    }

    if (!provider.apiKey) {
      return res.status(400).json({
        message:
          "Provider API key is not configured"
      });
    }

    const baseUrl =
      normalizeProviderUrl(
        provider.apiUrl
      );

    const servicesUrl =
      `${baseUrl}/services`;

    let response;

    try {
      response =
        await fetch(
          servicesUrl,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded",

              Accept:
                "application/json"
            },

            body:
              buildProviderRequest({
                apiKey:
                  provider.apiKey,

                action:
                  "services"
              }),

            signal:
              createAbortSignal()
          }
        );

    } catch (error) {
      console.error(
        "PROVIDER CONNECTION REQUEST ERROR:",
        error.message
      );

      return res.status(502).json({
        message:
          "Unable to connect to provider"
      });
    }

    let responseText;

    try {
      responseText =
        await readResponseTextSafely(
          response
        );
    } catch {
      return res.status(502).json({
        message:
          "Provider response is too large"
      });
    }

    if (!response.ok) {
      return res.status(502).json({
        message:
          "Provider connection failed"
      });
    }

    const providerResponse =
      parseProviderJson(
        responseText
      );

    if (!Array.isArray(providerResponse)) {
      return res.status(502).json({
        message:
          "Provider returned an invalid services response"
      });
    }

    return res.status(200).json({
      message:
        "Provider connection successful",

      provider: {
        _id:
          provider._id,

        name:
          provider.name,

        status:
          provider.status
      },

      servicesReceived:
        providerResponse.length
    });

  } catch (error) {
    console.error(
      "TEST PROVIDER CONNECTION ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Server error"
    });
  }
};

// ======================================================
// GET PROVIDER BALANCE
// ======================================================

const getProviderBalance = async (req, res) => {
  let provider = null;

  const startTime =
    Date.now();

  try {
    const {
      providerId
    } = req.params;

    if (!validateProviderId(providerId)) {
      return res.status(400).json({
        message:
          "Invalid provider ID"
      });
    }

    provider =
      await Provider.findById(
        providerId
      ).select("+apiKey");

    if (!provider) {
      return res.status(404).json({
        message:
          "Provider not found"
      });
    }

    if (provider.status !== "active") {
      return res.status(400).json({
        message:
          "Provider is inactive"
      });
    }

    if (!provider.apiUrl) {
      return res.status(400).json({
        message:
          "Provider API URL is not configured"
      });
    }

    if (!provider.apiKey) {
      return res.status(400).json({
        message:
          "Provider API key is not configured"
      });
    }

    const baseUrl =
      normalizeProviderUrl(
        provider.apiUrl
      );

    const balanceUrl =
      `${baseUrl}/balance`;

    let response;

    try {
      response =
        await fetch(
          balanceUrl,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded",

              Accept:
                "application/json"
            },

            body:
              buildProviderRequest({
                apiKey:
                  provider.apiKey,

                action:
                  "balance"
              }),

            signal:
              createAbortSignal()
          }
        );

    } catch (error) {
      console.error(
        "PROVIDER BALANCE REQUEST ERROR:",
        error.message
      );

      await logProviderFailure({
        providerId:
          provider._id,

        operation:
          "balance",

        method:
          "POST",

        endpoint:
          balanceUrl,

        requestPayload: {
          action:
            "balance"
        },

        errorMessage:
          "Unable to connect to provider",

        durationMs:
          Date.now() - startTime
      });

      return res.status(502).json({
        message:
          "Unable to connect to provider"
      });
    }

    let responseText;

    try {
      responseText =
        await readResponseTextSafely(
          response
        );
    } catch {
      await logProviderFailure({
        providerId:
          provider._id,

        operation:
          "balance",

        method:
          "POST",

        endpoint:
          balanceUrl,

        errorMessage:
          "Provider response is too large",

        durationMs:
          Date.now() - startTime
      });

      return res.status(502).json({
        message:
          "Provider response is too large"
      });
    }

    if (!response.ok) {
      await logProviderFailure({
        providerId:
          provider._id,

        operation:
          "balance",

        method:
          "POST",

        endpoint:
          balanceUrl,

        httpStatus:
          response.status,

        errorMessage:
          `Provider returned HTTP ${response.status}`,

        durationMs:
          Date.now() - startTime
      });

      return res.status(502).json({
        message:
          "Provider balance request failed"
      });
    }

    const providerResponse =
      parseProviderJson(
        responseText
      );

    if (!providerResponse) {
      await logProviderFailure({
        providerId:
          provider._id,

        operation:
          "balance",

        method:
          "POST",

        endpoint:
          balanceUrl,

        httpStatus:
          response.status,

        errorMessage:
          "Invalid JSON response received from provider",

        durationMs:
          Date.now() - startTime
      });

      return res.status(502).json({
        message:
          "Invalid response received from provider"
      });
    }

    const rawBalance =
      providerResponse?.balance;

    const numericBalance =
      Number(rawBalance);

    if (
      rawBalance === undefined ||
      rawBalance === null ||
      !Number.isFinite(
        numericBalance
      ) ||
      numericBalance < 0
    ) {
      await logProviderFailure({
        providerId:
          provider._id,

        operation:
          "balance",

        method:
          "POST",

        endpoint:
          balanceUrl,

        httpStatus:
          response.status,

        errorMessage:
          "Provider returned an invalid balance response",

        durationMs:
          Date.now() - startTime
      });

      return res.status(502).json({
        message:
          "Provider returned an invalid balance response"
      });
    }

    const currency =
      typeof providerResponse.currency ===
        "string" &&
      providerResponse.currency.trim()
        ? providerResponse.currency
            .trim()
            .slice(0, 20)
        : "INR";

    const finalBalance =
      Number(
        numericBalance.toFixed(2)
      );

    await logProviderSuccess({
      providerId:
        provider._id,

      operation:
        "balance",

      method:
        "POST",

      endpoint:
        balanceUrl,

      requestPayload: {
        action:
          "balance"
      },

      httpStatus:
        response.status,

      responsePayload: {
        balance:
          finalBalance,

        currency
      },

      durationMs:
        Date.now() - startTime
    });

    return res.status(200).json({
      success: true,

      message:
        "Provider balance fetched successfully",

      provider: {
        _id:
          provider._id,

        name:
          provider.name,

        status:
          provider.status
      },

      balance:
        finalBalance,

      currency
    });

  } catch (error) {
    console.error(
      "GET PROVIDER BALANCE ERROR:",
      error
    );

    if (provider?._id) {
      await logProviderFailure({
        providerId:
          provider._id,

        operation:
          "balance",

        method:
          "POST",

        endpoint:
          provider.apiUrl
            ? `${String(provider.apiUrl).replace(/\/+$/, "")}/balance`
            : "/balance",

        requestPayload: {
          action:
            "balance"
        },

        errorMessage:
          "Provider balance operation failed",

        durationMs:
          Date.now() - startTime
      }).catch(
        (logError) => {
          console.error(
            "PROVIDER FAILURE LOG ERROR:",
            logError
          );
        }
      );
    }

    return res.status(500).json({
      message:
        "Server error"
    });
  }
};

// ======================================================
// NORMALIZE PROVIDER SERVICE
// ======================================================

const normalizeProviderService = (
  providerService
) => {
  if (
    !providerService ||
    typeof providerService !== "object" ||
    Array.isArray(providerService)
  ) {
    return null;
  }

  const externalServiceId =
    providerService.service ??
    providerService.id;

  const serviceName =
    providerService.name;

  const providerCategory =
    typeof providerService.category === "string" &&
    providerService.category.trim()
      ? providerService.category.trim()
      : "Other";

  const rate =
    Number(
      providerService.rate ??
      providerService.price ??
      0
    );

  const min =
    Number(
      providerService.min ??
      1
    );

  const max =
    Number(
      providerService.max ??
      1
    );

  if (
    externalServiceId === undefined ||
    externalServiceId === null ||
    !isNonEmptyString(
      String(serviceName || "")
    ) ||
    !Number.isFinite(rate) ||
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    rate < 0 ||
    min < 1 ||
    max < 1 ||
    min > max
  ) {
    return null;
  }

  if (
    String(serviceName).trim().length >
    500
  ) {
    return null;
  }

  return {
    externalServiceId:
      String(
        externalServiceId
      ).trim(),

    serviceName:
      String(
        serviceName
      ).trim()
        .slice(0, 500),

    providerCategory:
      providerCategory
        .slice(0, 200),

    rate,

    min,

    max,

    platform:
      isNonEmptyString(
        providerService.platform
      )
        ? providerService.platform
            .trim()
            .slice(0, 100)
        : null,

    description:
      sanitizeText(
        providerService.description,
        5000
      ),

    refill:
      Boolean(
        providerService.refill
      ),

    cancel:
      Boolean(
        providerService.cancel
      ),

    dripFeed:
      Boolean(
        providerService.dripfeed ??
        providerService.dripFeed
      )
  };
};

// ======================================================
// FIND / CREATE CATEGORY
// ======================================================

const findOrCreateCategory = async ({
  name,
  providerName
}) => {
  const categoryName =
    sanitizeText(
      name,
      200
    ) || "Other";

  let category =
    await Category.findOne({
      name:
        categoryName
    });

  if (!category) {
    try {
      category =
        await Category.create({
          name:
            categoryName,

          description:
            `Imported from ${providerName}`,

          status:
            "active",

          sortOrder:
            0
        });
    } catch (error) {
      if (error.code === 11000) {
        category =
          await Category.findOne({
            name:
              categoryName
          });
      } else {
        throw error;
      }
    }
  }

  return category;
};

// ======================================================
// SYNC PROVIDER SERVICES
// ======================================================

const syncProviderServices = async (req, res) => {
  try {
    const {
      providerId
    } = req.params;

    if (!validateProviderId(providerId)) {
      return res.status(400).json({
        message:
          "Invalid provider ID"
      });
    }

    const provider =
      await Provider.findById(
        providerId
      ).select("+apiKey");

    if (!provider) {
      return res.status(404).json({
        message:
          "Provider not found"
      });
    }

    if (provider.status !== "active") {
      return res.status(400).json({
        message:
          "Provider is inactive"
      });
    }

    if (!provider.apiUrl) {
      return res.status(400).json({
        message:
          "Provider API URL is not configured"
      });
    }

    if (!provider.apiKey) {
      return res.status(400).json({
        message:
          "Provider API key is not configured"
      });
    }

    const baseUrl =
      normalizeProviderUrl(
        provider.apiUrl
      );

    const servicesUrl =
      `${baseUrl}/services`;

    let response;

    try {
      response =
        await fetch(
          servicesUrl,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded",

              Accept:
                "application/json"
            },

            body:
              buildProviderRequest({
                apiKey:
                  provider.apiKey,

                action:
                  "services"
              }),

            signal:
              createAbortSignal()
          }
        );

    } catch (error) {
      console.error(
        "PROVIDER SYNC REQUEST ERROR:",
        error.message
      );

      return res.status(502).json({
        message:
          "Unable to connect to provider"
      });
    }

    let responseText;

    try {
      responseText =
        await readResponseTextSafely(
          response
        );
    } catch {
      return res.status(502).json({
        message:
          "Provider response is too large"
      });
    }

    if (!response.ok) {
      return res.status(502).json({
        message:
          "Provider API request failed"
      });
    }

    const providerServices =
      parseProviderJson(
        responseText
      );

    if (!Array.isArray(providerServices)) {
      return res.status(502).json({
        message:
          "Provider returned an invalid services response"
      });
    }

    if (
      providerServices.length >
      MAX_IMPORTED_SERVICES
    ) {
      return res.status(502).json({
        message:
          "Provider returned too many services"
      });
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (
      const rawProviderService
      of providerServices
    ) {
      const normalized =
        normalizeProviderService(
          rawProviderService
        );

      if (!normalized) {
        skipped++;
        continue;
      }

      const category =
        await findOrCreateCategory({
          name:
            normalized.providerCategory,

          providerName:
            provider.name
        });

      const providerServiceId =
        normalized.externalServiceId;

      const internalServiceId =
        `${provider._id}-${providerServiceId}`;

      const sellingPrice =
        Number(
          normalized.rate.toFixed(2)
        );

      let service =
        await Service.findOne({
          providerId:
            provider._id,

          providerServiceId
        });

      if (service) {
        service.categoryId =
          category._id;

        service.platform =
          normalized.platform ||
          service.platform ||
          normalized.providerCategory ||
          "Other";

        service.name =
          normalized.serviceName;

        service.description =
          normalized.description ||
          service.description ||
          "";

        service.cost =
          normalized.rate;

        service.sellingPrice =
          sellingPrice;

        service.min =
          normalized.min;

        service.max =
          normalized.max;

        service.refill =
          normalized.refill;

        service.cancel =
          normalized.cancel;

        service.dripFeed =
          normalized.dripFeed;

        service.status =
          "active";

        service.isImported =
          true;

        await service.save();

        updated++;
      } else {
        await Service.create({
          serviceId:
            internalServiceId,

          categoryId:
            category._id,

          platform:
            normalized.platform ||
            normalized.providerCategory ||
            "Other",

          name:
            normalized.serviceName,

          description:
            normalized.description,

          providerId:
            provider._id,

          providerServiceId,

          cost:
            normalized.rate,

          sellingPrice,

          min:
            normalized.min,

          max:
            normalized.max,

          status:
            "active",

          sortOrder:
            0,

          refill:
            normalized.refill,

          cancel:
            normalized.cancel,

          dripFeed:
            normalized.dripFeed,

          markupType:
            "fixed",

          markupValue:
            0,

          isImported:
            true
        });

        created++;
      }
    }

    return res.status(200).json({
      message:
        "Provider services synchronized successfully",

      provider: {
        _id:
          provider._id,

        name:
          provider.name
      },

      sync: {
        totalReceived:
          providerServices.length,

        created,

        updated,

        skipped
      }
    });

  } catch (error) {
    console.error(
      "SYNC PROVIDER SERVICES ERROR:",
      error
    );

    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "Duplicate service detected during synchronization"
      });
    }

    return res.status(500).json({
      message:
        "Server error"
    });
  }
};

// ======================================================
// IMPORT SELECTED PROVIDER SERVICES
// ======================================================

const importSelectedProviderServices = async (
  req,
  res
) => {
  try {
    const {
      providerId
    } = req.params;

    if (!validateProviderId(providerId)) {
      return res.status(400).json({
        message:
          "Invalid provider ID"
      });
    }

    const provider =
      await Provider.findById(
        providerId
      ).select("+apiKey");

    if (!provider) {
      return res.status(404).json({
        message:
          "Provider not found"
      });
    }

    if (provider.status !== "active") {
      return res.status(400).json({
        message:
          "Provider is inactive"
      });
    }

    if (!provider.apiUrl) {
      return res.status(400).json({
        message:
          "Provider API URL is not configured"
      });
    }

    if (!provider.apiKey) {
      return res.status(400).json({
        message:
          "Provider API key is not configured"
      });
    }

    const {
      serviceIds
    } = req.body || {};

    if (!Array.isArray(serviceIds)) {
      return res.status(400).json({
        message:
          "serviceIds must be an array"
      });
    }

    if (
      serviceIds.length === 0
    ) {
      return res.status(400).json({
        message:
          "At least one serviceId is required"
      });
    }

    if (
      serviceIds.length >
      MAX_IMPORTED_SERVICES
    ) {
      return res.status(400).json({
        message:
          "Too many serviceIds requested"
      });
    }

    const selectedServiceIds = [
      ...new Set(
        serviceIds
          .filter(
            (serviceId) =>
              serviceId !== undefined &&
              serviceId !== null
          )
          .map(
            (serviceId) =>
              String(
                serviceId
              ).trim()
          )
          .filter(Boolean)
          .slice(
            0,
            MAX_IMPORTED_SERVICES
          )
      )
    ];

    if (
      selectedServiceIds.length === 0
    ) {
      return res.status(400).json({
        message:
          "At least one valid serviceId is required"
      });
    }

    const baseUrl =
      normalizeProviderUrl(
        provider.apiUrl
      );

    const servicesUrl =
      `${baseUrl}/services`;

    let response;

    try {
      response =
        await fetch(
          servicesUrl,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded",

              Accept:
                "application/json"
            },

            body:
              buildProviderRequest({
                apiKey:
                  provider.apiKey,

                action:
                  "services"
              }),

            signal:
              createAbortSignal()
          }
        );

    } catch (error) {
      console.error(
        "PROVIDER SELECTED IMPORT REQUEST ERROR:",
        error.message
      );

      return res.status(502).json({
        message:
          "Unable to connect to provider"
      });
    }

    let responseText;

    try {
      responseText =
        await readResponseTextSafely(
          response
        );
    } catch {
      return res.status(502).json({
        message:
          "Provider response is too large"
      });
    }

    if (!response.ok) {
      return res.status(502).json({
        message:
          "Provider API request failed"
      });
    }

    const providerServices =
      parseProviderJson(
        responseText
      );

    if (!Array.isArray(providerServices)) {
      return res.status(502).json({
        message:
          "Provider returned an invalid services response"
      });
    }

    if (
      providerServices.length >
      MAX_IMPORTED_SERVICES
    ) {
      return res.status(502).json({
        message:
          "Provider returned too many services"
      });
    }

    const selectedServices =
      providerServices.filter(
        (providerService) => {
          if (
            !providerService ||
            typeof providerService !==
              "object"
          ) {
            return false;
          }

          const externalServiceId =
            providerService.service ??
            providerService.id;

          if (
            externalServiceId === undefined ||
            externalServiceId === null
          ) {
            return false;
          }

          return selectedServiceIds.includes(
            String(
              externalServiceId
            ).trim()
          );
        }
      );

    const foundServiceIds =
      selectedServices.map(
        (providerService) =>
          String(
            providerService.service ??
            providerService.id
          ).trim()
      );

    const missingServiceIds =
      selectedServiceIds.filter(
        (serviceId) =>
          !foundServiceIds.includes(
            serviceId
          )
      );

    let created = 0;
    let updated = 0;
    let skipped = 0;

    const importedServices = [];

    for (
      const rawProviderService
      of selectedServices
    ) {
      const normalized =
        normalizeProviderService(
          rawProviderService
        );

      if (!normalized) {
        skipped++;
        continue;
      }

      const category =
        await findOrCreateCategory({
          name:
            normalized.providerCategory,

          providerName:
            provider.name
        });

      const providerServiceId =
        normalized.externalServiceId;

      const internalServiceId =
        `${provider._id}-${providerServiceId}`;

      const sellingPrice =
        Number(
          normalized.rate.toFixed(2)
        );

      let service =
        await Service.findOne({
          providerId:
            provider._id,

          providerServiceId
        });

      if (service) {
        service.categoryId =
          category._id;

        service.platform =
          normalized.platform ||
          service.platform ||
          normalized.providerCategory ||
          "Other";

        service.name =
          normalized.serviceName;

        service.description =
          normalized.description ||
          service.description ||
          "";

        service.cost =
          normalized.rate;

        service.sellingPrice =
          sellingPrice;

        service.min =
          normalized.min;

        service.max =
          normalized.max;

        service.refill =
          normalized.refill;

        service.cancel =
          normalized.cancel;

        service.dripFeed =
          normalized.dripFeed;

        service.status =
          "active";

        service.isImported =
          true;

        await service.save();

        updated++;
      } else {
        service =
          await Service.create({
            serviceId:
              internalServiceId,

            categoryId:
              category._id,

            platform:
              normalized.platform ||
              normalized.providerCategory ||
              "Other",

            name:
              normalized.serviceName,

            description:
              normalized.description,

            providerId:
              provider._id,

            providerServiceId,

            cost:
              normalized.rate,

            sellingPrice,

            min:
              normalized.min,

            max:
              normalized.max,

            status:
              "active",

            sortOrder:
              0,

            refill:
              normalized.refill,

            cancel:
              normalized.cancel,

            dripFeed:
              normalized.dripFeed,

            markupType:
              "fixed",

            markupValue:
              0,

            isImported:
              true
          });

        created++;
      }

      importedServices.push({
        providerServiceId,

        serviceId:
          service.serviceId,

        name:
          service.name,

        category:
          category.name,

        cost:
          service.cost,

        sellingPrice:
          service.sellingPrice,

        min:
          service.min,

        max:
          service.max,

        status:
          service.status
      });
    }

    return res.status(200).json({
      success: true,

      message:
        "Selected provider services imported successfully",

      provider: {
        _id:
          provider._id,

        name:
          provider.name
      },

      import: {
        requested:
          selectedServiceIds.length,

        found:
          selectedServices.length,

        created,

        updated,

        skipped,

        missing:
          missingServiceIds
      },

      services:
        importedServices
    });

  } catch (error) {
    console.error(
      "IMPORT SELECTED PROVIDER SERVICES ERROR:",
      error
    );

    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "Duplicate service detected during selected import"
      });
    }

    return res.status(500).json({
      message:
        "Server error"
    });
  }
};

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  createProvider,
  getAllProviders,
  getProviderById,
  updateProvider,
  deleteProvider,
  updateProviderStatus,
  updateProviderPriority,
  testProviderConnection,
  getProviderBalance,
  syncProviderServices,
  importSelectedProviderServices
};

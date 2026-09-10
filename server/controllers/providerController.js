const Provider = require("../models/Provider");
const Service = require("../models/Service");
const Category = require("../models/Category");

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
      isDefault
    } = req.body || {};

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        message: "Provider name is required"
      });
    }

    if (!apiUrl || typeof apiUrl !== "string" || !apiUrl.trim()) {
      return res.status(400).json({
        message: "Provider API URL is required"
      });
    }

    if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
      return res.status(400).json({
        message: "Provider API key is required"
      });
    }

    const existingProvider = await Provider.findOne({
      name: name.trim()
    });

    if (existingProvider) {
      return res.status(409).json({
        message: "Provider already exists"
      });
    }

    try {
      new URL(apiUrl.trim());
    } catch (error) {
      return res.status(400).json({
        message: "Invalid provider API URL"
      });
    }

    const selectedStatus = status || "active";

    if (!["active", "inactive"].includes(selectedStatus)) {
      return res.status(400).json({
        message: "Invalid provider status"
      });
    }

    const numericSortOrder =
      sortOrder !== undefined ? Number(sortOrder) : 0;

    if (
      !Number.isFinite(numericSortOrder) ||
      numericSortOrder < 0
    ) {
      return res.status(400).json({
        message: "Sort order must be a valid non-negative number"
      });
    }

    const provider = await Provider.create({
      name: name.trim(),

      // Store only BASE URL
      apiUrl: apiUrl.trim().replace(/\/+$/, ""),

      apiKey: apiKey.trim(),

      status: selectedStatus,

      description:
        typeof description === "string"
          ? description.trim()
          : "",

      sortOrder: numericSortOrder,

      isDefault: Boolean(isDefault)
    });

    const providerResponse = provider.toObject();

    delete providerResponse.apiKey;

    return res.status(201).json({
      message: "Provider created successfully",
      provider: providerResponse
    });
  } catch (error) {
    console.error("CREATE PROVIDER ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "Provider already exists"
      });
    }

    return res.status(500).json({
      message: "Server error"
    });
  }
};

// ======================================================
// GET ALL PROVIDERS
// ======================================================

const getAllProviders = async (req, res) => {
  try {
    const providers = await Provider.find()
      .select("-apiKey")
      .sort({
        sortOrder: 1,
        createdAt: -1
      });

    return res.status(200).json({
      message: "Providers fetched successfully",
      count: providers.length,
      providers
    });
  } catch (error) {
    console.error("GET ALL PROVIDERS ERROR:", error);

    return res.status(500).json({
      message: "Server error"
    });
  }
};

// ======================================================
// GET PROVIDER BY ID
// ======================================================

const getProviderById = async (req, res) => {
  try {
    const provider = await Provider.findById(
      req.params.providerId
    ).select("-apiKey");

    if (!provider) {
      return res.status(404).json({
        message: "Provider not found"
      });
    }

    return res.status(200).json({
      message: "Provider fetched successfully",
      provider
    });
  } catch (error) {
    console.error("GET PROVIDER BY ID ERROR:", error);

    return res.status(500).json({
      message: "Server error"
    });
  }
};

// ======================================================
// UPDATE PROVIDER
// ======================================================

const updateProvider = async (req, res) => {
  try {
    const {
      name,
      apiUrl,
      apiKey,
      status,
      description,
      sortOrder,
      isDefault
    } = req.body || {};

    const provider = await Provider.findById(
      req.params.providerId
    ).select("+apiKey");

    if (!provider) {
      return res.status(404).json({
        message: "Provider not found"
      });
    }

    // --------------------------------------------------
    // NAME
    // --------------------------------------------------

    if (name !== undefined) {
      if (
        typeof name !== "string" ||
        !name.trim()
      ) {
        return res.status(400).json({
          message: "Provider name cannot be empty"
        });
      }

      const duplicateProvider =
        await Provider.findOne({
          name: name.trim(),
          _id: {
            $ne: provider._id
          }
        });

      if (duplicateProvider) {
        return res.status(409).json({
          message: "Provider already exists"
        });
      }

      provider.name = name.trim();
    }

    // --------------------------------------------------
    // API URL
    // --------------------------------------------------

    if (apiUrl !== undefined) {
      if (
        typeof apiUrl !== "string" ||
        !apiUrl.trim()
      ) {
        return res.status(400).json({
          message: "Provider API URL cannot be empty"
        });
      }

      try {
        new URL(apiUrl.trim());
      } catch (error) {
        return res.status(400).json({
          message: "Invalid provider API URL"
        });
      }

      // Store BASE URL only
      provider.apiUrl =
        apiUrl.trim().replace(/\/+$/, "");
    }

    // --------------------------------------------------
    // API KEY
    // --------------------------------------------------

    if (apiKey !== undefined) {
      if (
        typeof apiKey !== "string" ||
        !apiKey.trim()
      ) {
        return res.status(400).json({
          message: "Provider API key cannot be empty"
        });
      }

      provider.apiKey = apiKey.trim();
    }

    // --------------------------------------------------
    // STATUS
    // --------------------------------------------------

    if (status !== undefined) {
      if (
        !["active", "inactive"].includes(status)
      ) {
        return res.status(400).json({
          message: "Invalid provider status"
        });
      }

      provider.status = status;
    }

    // --------------------------------------------------
    // DESCRIPTION
    // --------------------------------------------------

    if (description !== undefined) {
      provider.description =
        typeof description === "string"
          ? description.trim()
          : "";
    }

    // --------------------------------------------------
    // SORT ORDER
    // --------------------------------------------------

    if (sortOrder !== undefined) {
      const numericSortOrder =
        Number(sortOrder);

      if (
        !Number.isFinite(numericSortOrder) ||
        numericSortOrder < 0
      ) {
        return res.status(400).json({
          message:
            "Sort order must be a valid non-negative number"
        });
      }

      provider.sortOrder = numericSortOrder;
    }

    // --------------------------------------------------
    // DEFAULT PROVIDER
    // --------------------------------------------------

    if (isDefault !== undefined) {
      provider.isDefault = Boolean(isDefault);
    }

    await provider.save();

    const providerResponse =
      provider.toObject();

    delete providerResponse.apiKey;

    return res.status(200).json({
      message: "Provider updated successfully",
      provider: providerResponse
    });
  } catch (error) {
    console.error("UPDATE PROVIDER ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "Provider already exists"
      });
    }

    return res.status(500).json({
      message: "Server error"
    });
  }
};

// ======================================================
// DELETE PROVIDER
// ======================================================

const deleteProvider = async (req, res) => {
  try {
    const provider = await Provider.findById(
      req.params.providerId
    );

    if (!provider) {
      return res.status(404).json({
        message: "Provider not found"
      });
    }

    await Provider.findByIdAndDelete(
      req.params.providerId
    );

    return res.status(200).json({
      message: "Provider deleted successfully"
    });
  } catch (error) {
    console.error("DELETE PROVIDER ERROR:", error);

    return res.status(500).json({
      message: "Server error"
    });
  }
};

// ======================================================
// UPDATE PROVIDER STATUS
// ======================================================

const updateProviderStatus = async (req, res) => {
  try {
    const { status } = req.body || {};

    if (
      !["active", "inactive"].includes(status)
    ) {
      return res.status(400).json({
        message:
          "Status must be either active or inactive"
      });
    }

    const provider = await Provider.findById(
      req.params.providerId
    );

    if (!provider) {
      return res.status(404).json({
        message: "Provider not found"
      });
    }

    provider.status = status;

    await provider.save();

    const providerResponse =
      provider.toObject();

    delete providerResponse.apiKey;

    return res.status(200).json({
      message:
        "Provider status updated successfully",
      provider: providerResponse
    });
  } catch (error) {
    console.error(
      "UPDATE PROVIDER STATUS ERROR:",
      error
    );

    return res.status(500).json({
      message: "Server error"
    });
  }
};

// ======================================================
// TEST PROVIDER CONNECTION
// ======================================================

const testProviderConnection = async (req, res) => {
  try {
    // --------------------------------------------------
    // FIND PROVIDER
    // --------------------------------------------------

    const provider = await Provider.findById(
      req.params.providerId
    ).select("+apiKey");

    if (!provider) {
      return res.status(404).json({
        message: "Provider not found"
      });
    }

    // --------------------------------------------------
    // CHECK STATUS
    // --------------------------------------------------

    if (provider.status !== "active") {
      return res.status(400).json({
        message: "Provider is inactive"
      });
    }

    // --------------------------------------------------
    // CHECK API URL
    // --------------------------------------------------

    if (!provider.apiUrl) {
      return res.status(400).json({
        message:
          "Provider API URL is not configured"
      });
    }

    // --------------------------------------------------
    // CHECK API KEY
    // --------------------------------------------------

    if (!provider.apiKey) {
      return res.status(400).json({
        message:
          "Provider API key is not configured"
      });
    }

    // --------------------------------------------------
    // BUILD SERVICES URL
    // --------------------------------------------------

    const baseUrl = String(provider.apiUrl)
      .replace(/\/+$/, "");

    const servicesUrl =
      `${baseUrl}/services`;

    console.log(
      "PROVIDER SERVICES URL:",
      servicesUrl
    );

    // --------------------------------------------------
    // CALL PROVIDER SERVICES API
    // --------------------------------------------------

    let response;

    try {
      const params =
        new URLSearchParams();

      params.append(
        "key",
        provider.apiKey
      );

      params.append(
        "action",
        "services"
      );

      response = await fetch(
        servicesUrl,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",

            Accept:
              "application/json"
          },

          body:
            params.toString()
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

    // --------------------------------------------------
    // READ RESPONSE
    // --------------------------------------------------

    console.log(
      "PROVIDER RESPONSE STATUS:",
      response.status
    );

    const responseText =
      await response.text();

    console.log(
      "PROVIDER RESPONSE TEXT:",
      responseText
    );

    // --------------------------------------------------
    // CHECK RESPONSE STATUS
    // --------------------------------------------------

    if (!response.ok) {
      return res.status(502).json({
        message:
          "Provider connection failed",

        statusCode:
          response.status
      });
    }

    // --------------------------------------------------
    // PARSE RESPONSE
    // --------------------------------------------------

    let providerResponse;

    try {
      providerResponse =
        JSON.parse(responseText);
    } catch (error) {
      return res.status(502).json({
        message:
          "Invalid response received from provider"
      });
    }

    // --------------------------------------------------
    // VALIDATE RESPONSE
    // --------------------------------------------------

    if (!Array.isArray(providerResponse)) {
      return res.status(502).json({
        message:
          "Provider returned an invalid services response"
      });
    }

    // --------------------------------------------------
    // SUCCESS
    // --------------------------------------------------

    return res.status(200).json({
      message:
        "Provider connection successful",

      provider: {
        _id: provider._id,
        name: provider.name,
        status: provider.status
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
      message: "Server error"
    });
  }
};

// ======================================================
// SYNC PROVIDER SERVICES
// ======================================================

const syncProviderServices = async (req, res) => {
  try {
    // --------------------------------------------------
    // FIND PROVIDER
    // --------------------------------------------------

    const provider = await Provider.findById(
      req.params.providerId
    ).select("+apiKey");

    if (!provider) {
      return res.status(404).json({
        message: "Provider not found"
      });
    }

    // --------------------------------------------------
    // CHECK STATUS
    // --------------------------------------------------

    if (provider.status !== "active") {
      return res.status(400).json({
        message: "Provider is inactive"
      });
    }

    // --------------------------------------------------
    // CHECK API URL
    // --------------------------------------------------

    if (!provider.apiUrl) {
      return res.status(400).json({
        message:
          "Provider API URL is not configured"
      });
    }

    // --------------------------------------------------
    // CHECK API KEY
    // --------------------------------------------------

    if (!provider.apiKey) {
      return res.status(400).json({
        message:
          "Provider API key is not configured"
      });
    }

    // --------------------------------------------------
    // BUILD SERVICES URL
    // --------------------------------------------------

    const baseUrl = String(provider.apiUrl)
      .replace(/\/+$/, "");

    const servicesUrl =
      `${baseUrl}/services`;

    console.log(
      "PROVIDER SYNC SERVICES URL:",
      servicesUrl
    );

    // --------------------------------------------------
    // CALL PROVIDER API
    // --------------------------------------------------

    let response;

    try {
      const params =
        new URLSearchParams();

      params.append(
        "key",
        provider.apiKey
      );

      params.append(
        "action",
        "services"
      );

      response = await fetch(
        servicesUrl,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",

            Accept:
              "application/json"
          },

          body:
            params.toString()
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

    // --------------------------------------------------
    // READ RESPONSE
    // --------------------------------------------------

    console.log(
      "PROVIDER SYNC RESPONSE STATUS:",
      response.status
    );

    const responseText =
      await response.text();

    console.log(
      "PROVIDER SYNC RESPONSE TEXT:",
      responseText
    );

    // --------------------------------------------------
    // CHECK RESPONSE
    // --------------------------------------------------

    if (!response.ok) {
      return res.status(502).json({
        message:
          "Provider API request failed",

        statusCode:
          response.status
      });
    }

    // --------------------------------------------------
    // PARSE RESPONSE
    // --------------------------------------------------

    let providerServices;

    try {
      providerServices =
        JSON.parse(responseText);
    } catch (error) {
      return res.status(502).json({
        message:
          "Invalid response received from provider"
      });
    }

    // --------------------------------------------------
    // VALIDATE RESPONSE
    // --------------------------------------------------

    if (!Array.isArray(providerServices)) {
      return res.status(502).json({
        message:
          "Provider returned an invalid services response"
      });
    }

    // --------------------------------------------------
    // SYNC COUNTERS
    // --------------------------------------------------

    let created = 0;
    let updated = 0;
    let skipped = 0;

    // --------------------------------------------------
    // PROCESS SERVICES
    // --------------------------------------------------

    for (const providerService of providerServices) {
      const externalServiceId =
        providerService.service ??
        providerService.id;

      const serviceName =
        providerService.name;

      const providerCategory =
        providerService.category ||
        "Other";

      const rate = Number(
        providerService.rate ??
        providerService.price ??
        0
      );

      const min = Number(
        providerService.min ??
        1
      );

      const max = Number(
        providerService.max ??
        1
      );

      // ------------------------------------------------
      // BASIC VALIDATION
      // ------------------------------------------------

      if (
        externalServiceId === undefined ||
        externalServiceId === null ||
        !serviceName ||
        !Number.isFinite(rate) ||
        !Number.isFinite(min) ||
        !Number.isFinite(max) ||
        min < 1 ||
        max < 1 ||
        min > max
      ) {
        skipped++;
        continue;
      }

      // ------------------------------------------------
      // FIND / CREATE CATEGORY
      // ------------------------------------------------

      let category =
        await Category.findOne({
          name:
            providerCategory.trim()
        });

      if (!category) {
        category =
          await Category.create({
            name:
              providerCategory.trim(),

            description:
              `Imported from ${provider.name}`,

            status:
              "active",

            sortOrder:
              0
          });
      }

      // ------------------------------------------------
      // PROVIDER SERVICE ID
      // ------------------------------------------------

      const providerServiceId =
        String(externalServiceId);

      // ------------------------------------------------
      // INTERNAL SERVICE ID
      // ------------------------------------------------

      const internalServiceId =
        `${provider._id}-${providerServiceId}`;

      // ------------------------------------------------
      // SELLING PRICE
      // ------------------------------------------------

      const sellingPrice =
        Number(rate.toFixed(2));

      // ------------------------------------------------
      // FIND EXISTING SERVICE
      // ------------------------------------------------

      let service =
        await Service.findOne({
          providerId:
            provider._id,

          providerServiceId
        });

      // ------------------------------------------------
      // UPDATE EXISTING SERVICE
      // ------------------------------------------------

      if (service) {
        service.categoryId =
          category._id;

        service.platform =
          providerService.platform ||
          service.platform ||
          providerCategory.trim() ||
          "Other";

        service.name =
          String(serviceName).trim();

        service.description =
          providerService.description ||
          service.description ||
          "";

        service.cost =
          rate;

        service.sellingPrice =
          sellingPrice;

        service.min =
          min;

        service.max =
          max;

        service.refill =
          Boolean(providerService.refill);

        service.cancel =
          Boolean(providerService.cancel);

        service.dripFeed =
          Boolean(
            providerService.dripfeed ??
            providerService.dripFeed
          );

        service.status =
          "active";

        service.isImported =
          true;

        await service.save();

        updated++;
      } else {
        // ------------------------------------------------
        // CREATE NEW SERVICE
        // ------------------------------------------------

        await Service.create({
          serviceId:
            internalServiceId,

          categoryId:
            category._id,

          platform:
            providerService.platform ||
            providerCategory.trim() ||
            "Other",

          name:
            String(serviceName).trim(),

          description:
            providerService.description ||
            "",

          providerId:
            provider._id,

          providerServiceId,

          cost:
            rate,

          sellingPrice,

          min,

          max,

          status:
            "active",

          sortOrder:
            0,

          refill:
            Boolean(providerService.refill),

          cancel:
            Boolean(providerService.cancel),

          dripFeed:
            Boolean(
              providerService.dripfeed ??
              providerService.dripFeed
            ),

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

    // --------------------------------------------------
    // SUCCESS RESPONSE
    // --------------------------------------------------

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
      message: "Server error"
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
  testProviderConnection,
  syncProviderServices
};
const Provider = require("../models/Provider");
const Service = require("../models/Service");
const Category = require("../models/Category");

const {
  logProviderSuccess,
  logProviderFailure
} = require("./providerLogService");

// ======================================================
// PROVIDER SERVICE SYNC
// ======================================================

// ======================================================
// FETCH PROVIDER SERVICES
// ======================================================

const fetchProviderServices = async (provider) => {
  if (!provider) {
    throw new Error("Provider is required");
  }

  if (!provider.apiUrl) {
    throw new Error("Provider API URL is missing");
  }

  if (!provider.apiKey) {
    throw new Error("Provider API key is missing");
  }

  const baseUrl = String(provider.apiUrl).replace(/\/+$/, "");
  const url = `${baseUrl}/services`;

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 10000);

  const startTime = Date.now();

  try {
    console.log("====================================");
    console.log("FETCHING PROVIDER SERVICES");
    console.log("PROVIDER:", provider.name);
    console.log("URL:", url);
    console.log("====================================");

    const response = await fetch(url, {
      method: "POST",

      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded"
      },

      body: new URLSearchParams({
        key: provider.apiKey,
        action: "services"
      }).toString(),

      signal: controller.signal
    });

    const responseText = await response.text();

    let data;

    try {
      data = JSON.parse(responseText);
    } catch (error) {
      const durationMs = Date.now() - startTime;

      await logProviderFailure({
        providerId: provider._id,
        operation: "services",
        method: "POST",
        endpoint: url,

        requestPayload: {
          key: provider.apiKey,
          action: "services"
        },

        httpStatus: response.status,

        responsePayload: {
          rawResponse: responseText
        },

        errorMessage:
          `Invalid provider response: ${responseText}`,

        errorCode: "INVALID_JSON",

        durationMs,

        attempt: 1,
        maxAttempts: 1
      });

      throw new Error(
        `Invalid provider response: ${responseText}`
      );
    }

    if (!response.ok) {
      const providerMessage =
        data?.error ||
        data?.message ||
        `Provider returned HTTP ${response.status}`;

      const durationMs = Date.now() - startTime;

      await logProviderFailure({
        providerId: provider._id,
        operation: "services",
        method: "POST",
        endpoint: url,

        requestPayload: {
          key: provider.apiKey,
          action: "services"
        },

        httpStatus: response.status,

        responsePayload: data,

        errorMessage: providerMessage,

        errorCode: `HTTP_${response.status}`,

        durationMs,

        attempt: 1,
        maxAttempts: 1
      });

      throw new Error(providerMessage);
    }

    if (!Array.isArray(data)) {
      const durationMs = Date.now() - startTime;

      await logProviderFailure({
        providerId: provider._id,
        operation: "services",
        method: "POST",
        endpoint: url,

        requestPayload: {
          key: provider.apiKey,
          action: "services"
        },

        httpStatus: response.status,

        responsePayload: data,

        errorMessage:
          "Invalid provider services response. Expected an array.",

        errorCode: "INVALID_SERVICES_RESPONSE",

        durationMs,

        attempt: 1,
        maxAttempts: 1
      });

      throw new Error(
        "Invalid provider services response. Expected an array."
      );
    }

    const durationMs = Date.now() - startTime;

    // --------------------------------------------------
    // SUCCESS LOG
    // --------------------------------------------------

    await logProviderSuccess({
      providerId: provider._id,

      operation: "services",

      method: "POST",

      endpoint: url,

      requestPayload: {
        key: provider.apiKey,
        action: "services"
      },

      httpStatus: response.status,

      responsePayload: {
        serviceCount: data.length
      },

      durationMs,

      attempt: 1,

      maxAttempts: 1
    });

    console.log(
      `Provider returned ${data.length} services`
    );

    console.log(
      "PROVIDER SERVICE FETCH SUCCESS"
    );

    return data;

  } catch (error) {

    // --------------------------------------------------
    // TIMEOUT
    // --------------------------------------------------

    if (error.name === "AbortError") {
      const durationMs = Date.now() - startTime;

      await logProviderFailure({
        providerId: provider._id,

        operation: "services",

        method: "POST",

        endpoint: url,

        requestPayload: {
          key: provider.apiKey,
          action: "services"
        },

        httpStatus: null,

        responsePayload: null,

        errorMessage:
          "Provider service request timed out after 10 seconds",

        errorCode: "TIMEOUT",

        durationMs,

        attempt: 1,

        maxAttempts: 1
      });

      throw new Error(
        "Provider service request timed out after 10 seconds"
      );
    }

    // --------------------------------------------------
    // IMPORTANT
    // --------------------------------------------------
    // JSON/HTTP/response validation failures are already
    // logged above. Avoid creating duplicate logs here.

    throw error;

  } finally {
    clearTimeout(timeout);
  }
};

// ======================================================
// VALIDATE PROVIDER SERVICE
// ======================================================

const validateProviderService = (providerService) => {
  if (!providerService) {
    throw new Error("Provider service is empty");
  }

  if (
    !providerService.service ||
    !String(providerService.service).trim()
  ) {
    throw new Error(
      "Provider service ID is missing"
    );
  }

  if (
    !providerService.name ||
    !String(providerService.name).trim()
  ) {
    throw new Error(
      `Provider service ${providerService.service} name is missing`
    );
  }

  const min = Number(providerService.min);
  const max = Number(providerService.max);
  const rate = Number(providerService.rate);

  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error(
      `Invalid rate for provider service ${providerService.service}`
    );
  }

  if (!Number.isInteger(min) || min < 1) {
    throw new Error(
      `Invalid minimum quantity for provider service ${providerService.service}`
    );
  }

  if (!Number.isInteger(max) || max < min) {
    throw new Error(
      `Invalid maximum quantity for provider service ${providerService.service}`
    );
  }

  return {
    providerServiceId:
      String(providerService.service).trim(),

    name:
      String(providerService.name).trim(),

    type:
      providerService.type
        ? String(providerService.type).trim()
        : "Default",

    category:
      providerService.category
        ? String(providerService.category).trim()
        : "General",

    rate,

    min,

    max,

    refill:
      providerService.refill === true ||
      providerService.refill === "true" ||
      providerService.refill === 1 ||
      providerService.refill === "1",

    cancel:
      providerService.cancel === true ||
      providerService.cancel === "true" ||
      providerService.cancel === 1 ||
      providerService.cancel === "1"
  };
};

// ======================================================
// GENERATE LOCAL SERVICE ID
// ======================================================

const generateLocalServiceId = async (
  providerId,
  providerServiceId
) => {
  const providerPrefix = String(providerId);

  const servicePrefix =
    `IMP-${providerPrefix}-${String(providerServiceId)}`;

  let serviceId = servicePrefix;

  let counter = 1;

  while (
    await Service.exists({
      serviceId
    })
  ) {
    serviceId =
      `${servicePrefix}-${counter}`;

    counter++;
  }

  return serviceId;
};

// ======================================================
// FIND OR CREATE CATEGORY
// ======================================================

const findOrCreateCategory = async (
  categoryName
) => {
  const cleanCategory =
    String(categoryName || "General").trim();

  if (!cleanCategory) {
    throw new Error(
      "Provider service category is missing"
    );
  }

  let category =
    await Category.findOne({
      name: cleanCategory
    });

  if (category) {
    return category;
  }

  console.log(
    `Creating missing category: ${cleanCategory}`
  );

  category =
    await Category.create({
      name: cleanCategory,

      description:
        "Category imported from provider"
    });

  return category;
};

// ======================================================
// SYNC PROVIDER SERVICES
// ======================================================

const syncProviderServices = async (
  providerId
) => {
  if (!providerId) {
    throw new Error(
      "Provider ID is required"
    );
  }

  // ----------------------------------------------------
  // FIND PROVIDER
  // ----------------------------------------------------

  const provider =
    await Provider.findById(providerId)
      .select("+apiKey");

  if (!provider) {
    throw new Error(
      "Provider not found"
    );
  }

  if (provider.status !== "active") {
    throw new Error(
      "Provider is inactive"
    );
  }

  // ----------------------------------------------------
  // FETCH PROVIDER SERVICES
  // ----------------------------------------------------

  const providerServices =
    await fetchProviderServices(provider);

  // ----------------------------------------------------
  // SYNC RESULT
  // ----------------------------------------------------

  const result = {
    providerId:
      provider._id,

    providerName:
      provider.name,

    fetched:
      providerServices.length,

    imported: 0,

    updated: 0,

    skipped: 0,

    failed: 0,

    services: []
  };

  // ----------------------------------------------------
  // PROCESS EACH PROVIDER SERVICE
  // ----------------------------------------------------

  for (
    const rawProviderService
    of providerServices
  ) {
    try {

      // ------------------------------------------------
      // VALIDATE
      // ------------------------------------------------

      const providerService =
        validateProviderService(
          rawProviderService
        );

      console.log(
        "------------------------------------"
      );

      console.log(
        "SYNCING PROVIDER SERVICE"
      );

      console.log(
        "PROVIDER:",
        provider.name
      );

      console.log(
        "PROVIDER SERVICE ID:",
        providerService.providerServiceId
      );

      // ------------------------------------------------
      // CHECK EXISTING SERVICE
      // ------------------------------------------------

      const existingService =
        await Service.findOne({
          providerId:
            provider._id,

          providerServiceId:
            providerService.providerServiceId
        });

      // =================================================
      // UPDATE EXISTING SERVICE
      // =================================================

      if (existingService) {

        // ----------------------------------------------
        // Preserve admin-controlled values
        // ----------------------------------------------

        const previousSellingPrice =
          existingService.sellingPrice;

        const previousMarkupType =
          existingService.markupType;

        const previousMarkupValue =
          existingService.markupValue;

        // ----------------------------------------------
        // Update provider-controlled fields
        // ----------------------------------------------

        existingService.name =
          providerService.name;

        existingService.platform =
          providerService.category;

        existingService.description =
          `${providerService.type} service imported from ${provider.name}`;

        // ----------------------------------------------
        // Provider rate updates COST only
        // ----------------------------------------------

        existingService.cost =
          providerService.rate;

        // ----------------------------------------------
        // Preserve admin selling price
        // ----------------------------------------------

        existingService.sellingPrice =
          previousSellingPrice;

        // ----------------------------------------------
        // Update quantity limits
        // ----------------------------------------------

        existingService.min =
          providerService.min;

        existingService.max =
          providerService.max;

        // ----------------------------------------------
        // Update provider capabilities
        // ----------------------------------------------

        existingService.refill =
          providerService.refill;

        existingService.cancel =
          providerService.cancel;

        // ----------------------------------------------
        // Provider service is active
        // ----------------------------------------------

        existingService.status =
          "active";

        existingService.isImported =
          true;

        // ----------------------------------------------
        // Preserve markup
        // ----------------------------------------------

        existingService.markupType =
          previousMarkupType || "fixed";

        existingService.markupValue =
          Number.isFinite(
            Number(previousMarkupValue)
          )
            ? Number(previousMarkupValue)
            : 0;

        // ----------------------------------------------
        // SAVE
        // ----------------------------------------------

        await existingService.save();

        result.updated++;

        result.services.push({
          providerServiceId:
            providerService.providerServiceId,

          serviceId:
            existingService.serviceId,

          action:
            "updated",

          cost:
            existingService.cost,

          sellingPrice:
            existingService.sellingPrice
        });

        console.log(
          "SERVICE UPDATED:",
          existingService.serviceId
        );

        continue;
      }

      // =================================================
      // CREATE NEW SERVICE
      // =================================================

      const serviceId =
        await generateLocalServiceId(
          provider._id,
          providerService.providerServiceId
        );

      // ------------------------------------------------
      // FIND OR CREATE CATEGORY
      // ------------------------------------------------

      const category =
        await findOrCreateCategory(
          providerService.category
        );

      // ------------------------------------------------
      // CREATE SERVICE
      // ------------------------------------------------

      const newService =
        await Service.create({
          serviceId,

          categoryId:
            category._id,

          platform:
            providerService.category,

          name:
            providerService.name,

          description:
            `${providerService.type} service imported from ${provider.name}`,

          providerId:
            provider._id,

          providerServiceId:
            providerService.providerServiceId,

          // Provider rate = cost
          cost:
            providerService.rate,

          // Initial selling price
          sellingPrice:
            providerService.rate,

          min:
            providerService.min,

          max:
            providerService.max,

          status:
            "active",

          sortOrder:
            0,

          refill:
            providerService.refill,

          cancel:
            providerService.cancel,

          dripFeed:
            false,

          markupType:
            "fixed",

          markupValue:
            0,

          isImported:
            true
        });

      result.imported++;

      result.services.push({
        providerServiceId:
          providerService.providerServiceId,

        serviceId:
          newService.serviceId,

        action:
          "imported",

        cost:
          newService.cost,

        sellingPrice:
          newService.sellingPrice
      });

      console.log(
        "SERVICE IMPORTED:",
        newService.serviceId
      );

    } catch (error) {

      console.error(
        `Provider service sync failed for service ${rawProviderService?.service}:`,
        error
      );

      result.failed++;

      result.services.push({
        providerServiceId:
          rawProviderService?.service || null,

        action:
          "failed",

        reason:
          error.message
      });
    }
  }

  // ====================================================
  // FINAL SYNC SUMMARY
  // ====================================================

  console.log(
    "===================================="
  );

  console.log(
    "PROVIDER SERVICE SYNC SUMMARY"
  );

  console.log(
    "PROVIDER:",
    provider.name
  );

  console.log(
    "FETCHED:",
    result.fetched
  );

  console.log(
    "IMPORTED:",
    result.imported
  );

  console.log(
    "UPDATED:",
    result.updated
  );

  console.log(
    "SKIPPED:",
    result.skipped
  );

  console.log(
    "FAILED:",
    result.failed
  );

  console.log(
    "===================================="
  );

  return result;
};

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  fetchProviderServices,
  validateProviderService,
  generateLocalServiceId,
  findOrCreateCategory,
  syncProviderServices
};
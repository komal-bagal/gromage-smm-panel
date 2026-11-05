const mongoose = require("mongoose");

const Service = require("../models/Service");
const Category = require("../models/Category");
const Provider = require("../models/Provider");

// ======================================================
// CONSTANTS
// ======================================================

const MARKUP_TYPES = ["fixed", "percentage"];
const SERVICE_STATUSES = ["active", "inactive"];
const MAX_BULK_SERVICES = 500;

// ======================================================
// HELPERS
// ======================================================

const parseBoolean = (value) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true" || normalized === "1") {
      return true;
    }

    if (normalized === "false" || normalized === "0" || normalized === "") {
      return false;
    }
  }

  return Boolean(value);
};

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

const isValidId = (value) =>
  (typeof value === "string" || value instanceof mongoose.Types.ObjectId) &&
  mongoose.Types.ObjectId.isValid(value);

const serverError = (res, label, error) => {
  console.error(label, error);

  return res.status(500).json({
    message: "Server error"
  });
};

// ======================================================
// CREATE SERVICE
// ======================================================

const createService = async (req, res) => {
  try {
    const {
      serviceId,
      categoryId,
      platform,
      name,
      description,
      providerId,
      providerServiceId,
      cost,
      sellingPrice,
      min,
      max,
      status,
      sortOrder,
      refill,
      cancel,
      dripFeed,
      markupType,
      markupValue,
      isImported
    } = req.body || {};

    // --------------------------------------------------
    // REQUIRED FIELDS
    // --------------------------------------------------

    if (!isNonEmptyString(serviceId)) {
      return res.status(400).json({
        message: "Service ID is required"
      });
    }

    if (!categoryId) {
      return res.status(400).json({
        message: "Category ID is required"
      });
    }

    if (!isValidId(categoryId)) {
      return res.status(400).json({
        message: "Invalid category ID"
      });
    }

    if (!isNonEmptyString(platform)) {
      return res.status(400).json({
        message: "Platform is required"
      });
    }

    if (!isNonEmptyString(name)) {
      return res.status(400).json({
        message: "Service name is required"
      });
    }

    if (providerId && !isValidId(providerId)) {
      return res.status(400).json({
        message: "Invalid provider ID"
      });
    }

    // --------------------------------------------------
    // CHECK CATEGORY
    // --------------------------------------------------

    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({
        message: "Category not found"
      });
    }

    // --------------------------------------------------
    // CHECK DUPLICATE SERVICE ID
    // --------------------------------------------------

    const existingService = await Service.findOne({
      serviceId: serviceId.trim()
    });

    if (existingService) {
      return res.status(409).json({
        message: "Service ID already exists"
      });
    }

    // --------------------------------------------------
    // NUMERIC VALUES
    // --------------------------------------------------

    const numericCost = Number(cost);
    const numericSellingPrice = Number(sellingPrice);
    const numericMin = Number(min);
    const numericMax = Number(max);

    const numericSortOrder =
      sortOrder !== undefined ? Number(sortOrder) : 0;

    const numericMarkupValue =
      markupValue !== undefined ? Number(markupValue) : 0;

    if (!Number.isFinite(numericCost) || numericCost < 0) {
      return res.status(400).json({
        message: "Cost must be a valid non-negative number"
      });
    }

    if (
      !Number.isFinite(numericSellingPrice) ||
      numericSellingPrice < 0
    ) {
      return res.status(400).json({
        message: "Selling price must be a valid non-negative number"
      });
    }

    if (!Number.isInteger(numericMin) || numericMin < 1) {
      return res.status(400).json({
        message: "Minimum quantity must be at least 1"
      });
    }

    if (!Number.isInteger(numericMax) || numericMax < 1) {
      return res.status(400).json({
        message: "Maximum quantity must be at least 1"
      });
    }

    if (numericMin > numericMax) {
      return res.status(400).json({
        message: "Minimum quantity cannot be greater than maximum quantity"
      });
    }

    if (!Number.isFinite(numericSortOrder) || numericSortOrder < 0) {
      return res.status(400).json({
        message: "Sort order must be a valid non-negative number"
      });
    }

    // --------------------------------------------------
    // STATUS VALIDATION
    // --------------------------------------------------

    const selectedStatus = status || "active";

    if (!SERVICE_STATUSES.includes(selectedStatus)) {
      return res.status(400).json({
        message: "Invalid status"
      });
    }

    // --------------------------------------------------
    // MARKUP VALIDATION
    // --------------------------------------------------

    const selectedMarkupType = markupType || "fixed";

    if (!MARKUP_TYPES.includes(selectedMarkupType)) {
      return res.status(400).json({
        message: "Invalid markup type"
      });
    }

    if (!Number.isFinite(numericMarkupValue) || numericMarkupValue < 0) {
      return res.status(400).json({
        message: "Markup value must be a valid non-negative number"
      });
    }

    if (
      selectedMarkupType === "percentage" &&
      numericMarkupValue > 100
    ) {
      return res.status(400).json({
        message: "Percentage markup cannot exceed 100"
      });
    }

    // --------------------------------------------------
    // CREATE
    // --------------------------------------------------

    const service = await Service.create({
      serviceId: serviceId.trim(),
      categoryId,
      platform: platform.trim(),
      name: name.trim(),
      description:
        typeof description === "string" ? description.trim() : "",
      providerId: providerId || null,
      providerServiceId: providerServiceId
        ? String(providerServiceId).trim()
        : null,
      cost: numericCost,
      sellingPrice: numericSellingPrice,
      min: numericMin,
      max: numericMax,
      status: selectedStatus,
      sortOrder: numericSortOrder,
      refill: parseBoolean(refill),
      cancel: parseBoolean(cancel),
      dripFeed: parseBoolean(dripFeed),
      markupType: selectedMarkupType,
      markupValue: numericMarkupValue,
      isImported: parseBoolean(isImported)
    });

    return res.status(201).json({
      message: "Service created successfully",
      service
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Service ID already exists"
      });
    }

    return serverError(res, "CREATE SERVICE ERROR:", error);
  }
};

// ======================================================
// GET ALL SERVICES
// ======================================================

const getAllServices = async (req, res) => {
  try {
    const services = await Service.find()
      .populate("categoryId", "name description status")
      .sort({
        sortOrder: 1,
        createdAt: -1
      });

    return res.status(200).json({
      message: "Services fetched successfully",
      count: services.length,
      services
    });
  } catch (error) {
    return serverError(res, "GET ALL SERVICES ERROR:", error);
  }
};

// ======================================================
// GET SERVICE BY ID
// ======================================================

const getServiceById = async (req, res) => {
  try {
    if (!isValidId(req.params.serviceId)) {
      return res.status(400).json({
        message: "Invalid service ID"
      });
    }

    const service = await Service.findById(
      req.params.serviceId
    ).populate("categoryId", "name description status");

    if (!service) {
      return res.status(404).json({
        message: "Service not found"
      });
    }

    return res.status(200).json({
      message: "Service fetched successfully",
      service
    });
  } catch (error) {
    return serverError(res, "GET SERVICE BY ID ERROR:", error);
  }
};

// ======================================================
// UPDATE SERVICE
// ======================================================

const updateService = async (req, res) => {
  try {
    const {
      serviceId,
      categoryId,
      platform,
      name,
      description,
      providerId,
      providerServiceId,
      cost,
      sellingPrice,
      min,
      max,
      status,
      sortOrder,
      refill,
      cancel,
      dripFeed,
      markupType,
      markupValue,
      isImported
    } = req.body || {};

    // --------------------------------------------------
    // FIND SERVICE
    // --------------------------------------------------

    if (!isValidId(req.params.serviceId)) {
      return res.status(400).json({
        message: "Invalid service ID"
      });
    }

    const service = await Service.findById(req.params.serviceId);

    if (!service) {
      return res.status(404).json({
        message: "Service not found"
      });
    }

    // --------------------------------------------------
    // SERVICE ID
    // --------------------------------------------------

    if (serviceId !== undefined) {
      if (!isNonEmptyString(serviceId)) {
        return res.status(400).json({
          message: "Service ID cannot be empty"
        });
      }

      const duplicateService = await Service.findOne({
        serviceId: serviceId.trim(),
        _id: { $ne: service._id }
      });

      if (duplicateService) {
        return res.status(409).json({
          message: "Service ID already exists"
        });
      }

      service.serviceId = serviceId.trim();
    }

    // --------------------------------------------------
    // CATEGORY
    // --------------------------------------------------

    if (categoryId !== undefined) {
      if (!isValidId(categoryId)) {
        return res.status(400).json({
          message: "Invalid category ID"
        });
      }

      const category = await Category.findById(categoryId);

      if (!category) {
        return res.status(404).json({
          message: "Category not found"
        });
      }

      service.categoryId = categoryId;
    }

    // --------------------------------------------------
    // PLATFORM
    // --------------------------------------------------

    if (platform !== undefined) {
      if (!isNonEmptyString(platform)) {
        return res.status(400).json({
          message: "Platform cannot be empty"
        });
      }

      service.platform = platform.trim();
    }

    // --------------------------------------------------
    // NAME
    // --------------------------------------------------

    if (name !== undefined) {
      if (!isNonEmptyString(name)) {
        return res.status(400).json({
          message: "Service name cannot be empty"
        });
      }

      service.name = name.trim();
    }

    // --------------------------------------------------
    // DESCRIPTION
    // --------------------------------------------------

    if (description !== undefined) {
      service.description =
        typeof description === "string" ? description.trim() : "";
    }

    // --------------------------------------------------
    // PROVIDER
    // --------------------------------------------------

    if (providerId !== undefined) {
      if (providerId && !isValidId(providerId)) {
        return res.status(400).json({
          message: "Invalid provider ID"
        });
      }

      service.providerId = providerId || null;
    }

    // --------------------------------------------------
    // PROVIDER SERVICE ID
    // --------------------------------------------------

    if (providerServiceId !== undefined) {
      service.providerServiceId = providerServiceId
        ? String(providerServiceId).trim()
        : null;
    }

    // --------------------------------------------------
    // COST
    // --------------------------------------------------

    if (cost !== undefined) {
      const numericCost = Number(cost);

      if (!Number.isFinite(numericCost) || numericCost < 0) {
        return res.status(400).json({
          message: "Cost must be a valid non-negative number"
        });
      }

      service.cost = numericCost;
    }

    // --------------------------------------------------
    // SELLING PRICE
    // --------------------------------------------------

    if (sellingPrice !== undefined) {
      const numericSellingPrice = Number(sellingPrice);

      if (
        !Number.isFinite(numericSellingPrice) ||
        numericSellingPrice < 0
      ) {
        return res.status(400).json({
          message: "Selling price must be a valid non-negative number"
        });
      }

      service.sellingPrice = numericSellingPrice;
    }

    // --------------------------------------------------
    // MIN
    // --------------------------------------------------

    if (min !== undefined) {
      const numericMin = Number(min);

      if (!Number.isInteger(numericMin) || numericMin < 1) {
        return res.status(400).json({
          message: "Minimum quantity must be at least 1"
        });
      }

      service.min = numericMin;
    }

    // --------------------------------------------------
    // MAX
    // --------------------------------------------------

    if (max !== undefined) {
      const numericMax = Number(max);

      if (!Number.isInteger(numericMax) || numericMax < 1) {
        return res.status(400).json({
          message: "Maximum quantity must be at least 1"
        });
      }

      service.max = numericMax;
    }

    // --------------------------------------------------
    // MIN / MAX CHECK
    // --------------------------------------------------

    if (service.min > service.max) {
      return res.status(400).json({
        message: "Minimum quantity cannot be greater than maximum quantity"
      });
    }

    // --------------------------------------------------
    // STATUS
    // --------------------------------------------------

    if (status !== undefined) {
      if (!SERVICE_STATUSES.includes(status)) {
        return res.status(400).json({
          message: "Invalid status"
        });
      }

      service.status = status;
    }

    // --------------------------------------------------
    // SORT ORDER
    // --------------------------------------------------

    if (sortOrder !== undefined) {
      const numericSortOrder = Number(sortOrder);

      if (!Number.isFinite(numericSortOrder) || numericSortOrder < 0) {
        return res.status(400).json({
          message: "Sort order must be a valid non-negative number"
        });
      }

      service.sortOrder = numericSortOrder;
    }

    // --------------------------------------------------
    // FLAGS
    // --------------------------------------------------

    if (refill !== undefined) {
      service.refill = parseBoolean(refill);
    }

    if (cancel !== undefined) {
      service.cancel = parseBoolean(cancel);
    }

    if (dripFeed !== undefined) {
      service.dripFeed = parseBoolean(dripFeed);
    }

    if (isImported !== undefined) {
      service.isImported = parseBoolean(isImported);
    }

    // --------------------------------------------------
    // MARKUP TYPE
    // --------------------------------------------------

    if (markupType !== undefined) {
      if (!MARKUP_TYPES.includes(markupType)) {
        return res.status(400).json({
          message: "Invalid markup type"
        });
      }

      service.markupType = markupType;
    }

    // --------------------------------------------------
    // MARKUP VALUE
    // --------------------------------------------------

    if (markupValue !== undefined) {
      const numericMarkupValue = Number(markupValue);

      if (
        !Number.isFinite(numericMarkupValue) ||
        numericMarkupValue < 0
      ) {
        return res.status(400).json({
          message: "Markup value must be a valid non-negative number"
        });
      }

      service.markupValue = numericMarkupValue;
    }

    // Validate the final combination, so changing only the type
    // (e.g. fixed -> percentage) can't leave an invalid stored value.
    if (
      service.markupType === "percentage" &&
      service.markupValue > 100
    ) {
      return res.status(400).json({
        message: "Percentage markup cannot exceed 100"
      });
    }

    // --------------------------------------------------
    // SAVE
    // --------------------------------------------------

    await service.save();

    return res.status(200).json({
      message: "Service updated successfully",
      service
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Service ID already exists"
      });
    }

    return serverError(res, "UPDATE SERVICE ERROR:", error);
  }
};

// ======================================================
// DELETE SERVICE
// ======================================================

const deleteService = async (req, res) => {
  try {
    if (!isValidId(req.params.serviceId)) {
      return res.status(400).json({
        message: "Invalid service ID"
      });
    }

    const deleted = await Service.findByIdAndDelete(
      req.params.serviceId
    );

    if (!deleted) {
      return res.status(404).json({
        message: "Service not found"
      });
    }

    return res.status(200).json({
      message: "Service deleted successfully"
    });
  } catch (error) {
    return serverError(res, "DELETE SERVICE ERROR:", error);
  }
};

// ======================================================
// UPDATE SERVICE STATUS
// ======================================================

const updateServiceStatus = async (req, res) => {
  try {
    const { status } = req.body || {};

    if (!SERVICE_STATUSES.includes(status)) {
      return res.status(400).json({
        message: "Status must be either active or inactive"
      });
    }

    if (!isValidId(req.params.serviceId)) {
      return res.status(400).json({
        message: "Invalid service ID"
      });
    }

    const service = await Service.findById(req.params.serviceId);

    if (!service) {
      return res.status(404).json({
        message: "Service not found"
      });
    }

    service.status = status;

    await service.save();

    return res.status(200).json({
      message: "Service status updated successfully",
      service
    });
  } catch (error) {
    return serverError(res, "UPDATE SERVICE STATUS ERROR:", error);
  }
};

// ======================================================
// BULK PRICE UPDATE
// ======================================================

const bulkPriceUpdate = async (req, res) => {
  try {
    const { serviceIds, markupType, markupValue } = req.body || {};

    // --------------------------------------------------
    // VALIDATE SERVICE IDS
    // --------------------------------------------------

    if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
      return res.status(400).json({
        message: "serviceIds must be a non-empty array"
      });
    }

    if (serviceIds.length > MAX_BULK_SERVICES) {
      return res.status(400).json({
        message: `serviceIds cannot contain more than ${MAX_BULK_SERVICES} items`
      });
    }

    if (!serviceIds.every(isValidId)) {
      return res.status(400).json({
        message: "serviceIds contains an invalid service ID"
      });
    }

    const uniqueServiceIds = [...new Set(serviceIds.map(String))];

    // --------------------------------------------------
    // VALIDATE MARKUP TYPE
    // --------------------------------------------------

    if (!MARKUP_TYPES.includes(markupType)) {
      return res.status(400).json({
        message: "Markup type must be fixed or percentage"
      });
    }

    // --------------------------------------------------
    // VALIDATE MARKUP VALUE
    // --------------------------------------------------

    const numericMarkupValue = Number(markupValue);

    if (!Number.isFinite(numericMarkupValue) || numericMarkupValue < 0) {
      return res.status(400).json({
        message: "Markup value must be a valid non-negative number"
      });
    }

    if (markupType === "percentage" && numericMarkupValue > 100) {
      return res.status(400).json({
        message: "Percentage markup cannot exceed 100"
      });
    }

    // --------------------------------------------------
    // FIND SERVICES
    // --------------------------------------------------

    const services = await Service.find({
      _id: { $in: uniqueServiceIds }
    });

    if (services.length === 0) {
      return res.status(404).json({
        message: "No services found"
      });
    }

    // --------------------------------------------------
    // UPDATE SELLING PRICE
    // --------------------------------------------------

    let updatedCount = 0;

    for (const service of services) {
      const cost = Number(service.cost);

      const newSellingPrice =
        markupType === "fixed"
          ? cost + numericMarkupValue
          : cost + (cost * numericMarkupValue) / 100;

      service.sellingPrice = Number(newSellingPrice.toFixed(2));
      service.markupType = markupType;
      service.markupValue = numericMarkupValue;

      await service.save();

      updatedCount++;
    }

    return res.status(200).json({
      message: "Bulk price update successful",
      updatedCount,
      markupType,
      markupValue: numericMarkupValue
    });
  } catch (error) {
    return serverError(res, "BULK PRICE UPDATE ERROR:", error);
  }
};

// ======================================================
// MAP PROVIDER SERVICE
// ======================================================

const mapProviderService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { providerId, providerServiceId } = req.body || {};

    // --------------------------------------------------
    // VALIDATION
    // --------------------------------------------------

    if (!providerId) {
      return res.status(400).json({
        message: "Provider ID is required"
      });
    }

    if (!isValidId(providerId)) {
      return res.status(400).json({
        message: "Invalid provider ID"
      });
    }

    if (!providerServiceId || !String(providerServiceId).trim()) {
      return res.status(400).json({
        message: "Provider service ID is required"
      });
    }

    if (!isValidId(serviceId)) {
      return res.status(400).json({
        message: "Invalid service ID"
      });
    }

    // --------------------------------------------------
    // FIND LOCAL SERVICE
    // --------------------------------------------------

    const service = await Service.findById(serviceId);

    if (!service) {
      return res.status(404).json({
        message: "Service not found"
      });
    }

    // --------------------------------------------------
    // FIND PROVIDER
    // --------------------------------------------------

    const provider = await Provider.findById(providerId);

    if (!provider) {
      return res.status(404).json({
        message: "Provider not found"
      });
    }

    if (provider.status !== "active") {
      return res.status(400).json({
        message: "Provider is inactive"
      });
    }

    const normalizedProviderServiceId = String(providerServiceId).trim();

    // --------------------------------------------------
    // CHECK DUPLICATE MAPPING
    // --------------------------------------------------

    const existingMapping = await Service.findOne({
      providerId: provider._id,
      providerServiceId: normalizedProviderServiceId,
      _id: { $ne: service._id }
    });

    if (existingMapping) {
      return res.status(409).json({
        message:
          "Provider service is already mapped to another local service",
        existingServiceId: existingMapping._id,
        existingService: existingMapping.serviceId
      });
    }

    // --------------------------------------------------
    // SAVE MAPPING
    // --------------------------------------------------

    service.providerId = provider._id;
    service.providerServiceId = normalizedProviderServiceId;

    await service.save();

    return res.status(200).json({
      success: true,
      message: "Provider service mapped successfully",
      mapping: {
        serviceId: service._id,
        localServiceId: service.serviceId,
        providerId: provider._id,
        providerName: provider.name,
        providerServiceId: normalizedProviderServiceId
      },
      service
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "Provider service is already mapped to another local service"
      });
    }

    return serverError(res, "MAP PROVIDER SERVICE ERROR:", error);
  }
};

// ======================================================
// EXPORT ALL CONTROLLERS
// ======================================================

module.exports = {
  createService,
  getAllServices,
  getServiceById,
  updateService,
  deleteService,
  updateServiceStatus,
  bulkPriceUpdate,
  mapProviderService
};
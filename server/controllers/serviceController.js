const Service = require("../models/Service");
const Category = require("../models/Category");

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

    if (!serviceId || !serviceId.trim()) {
      return res.status(400).json({
        message: "Service ID is required"
      });
    }

    if (!categoryId) {
      return res.status(400).json({
        message: "Category ID is required"
      });
    }

    if (!platform || !platform.trim()) {
      return res.status(400).json({
        message: "Platform is required"
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Service name is required"
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
      sortOrder !== undefined
        ? Number(sortOrder)
        : 0;

    const numericMarkupValue =
      markupValue !== undefined
        ? Number(markupValue)
        : 0;

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
        message:
          "Selling price must be a valid non-negative number"
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
        message:
          "Minimum quantity cannot be greater than maximum quantity"
      });
    }

    if (
      !Number.isFinite(numericSortOrder) ||
      numericSortOrder < 0
    ) {
      return res.status(400).json({
        message:
          "Sort order must be a valid non-negative number"
      });
    }

    // --------------------------------------------------
    // MARKUP VALIDATION
    // --------------------------------------------------

    const selectedMarkupType =
      markupType || "fixed";

    if (
      !["fixed", "percentage"].includes(
        selectedMarkupType
      )
    ) {
      return res.status(400).json({
        message: "Invalid markup type"
      });
    }

    if (
      !Number.isFinite(numericMarkupValue) ||
      numericMarkupValue < 0
    ) {
      return res.status(400).json({
        message:
          "Markup value must be a valid non-negative number"
      });
    }

    if (
      selectedMarkupType === "percentage" &&
      numericMarkupValue > 100
    ) {
      return res.status(400).json({
        message:
          "Percentage markup cannot exceed 100"
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

      description: description
        ? description.trim()
        : "",

      providerId: providerId || null,

      providerServiceId:
        providerServiceId
          ? providerServiceId.trim()
          : null,

      cost: numericCost,

      sellingPrice: numericSellingPrice,

      min: numericMin,

      max: numericMax,

      status: status || "active",

      sortOrder: numericSortOrder,

      refill: Boolean(refill),

      cancel: Boolean(cancel),

      dripFeed: Boolean(dripFeed),

      markupType: selectedMarkupType,

      markupValue: numericMarkupValue,

      isImported: Boolean(isImported)
    });

    return res.status(201).json({
      message: "Service created successfully",
      service
    });

  } catch (error) {
    console.error(
      "CREATE SERVICE ERROR:",
      error
    );

    if (error.code === 11000) {
      return res.status(409).json({
        message: "Service ID already exists"
      });
    }

    return res.status(500).json({
      message: "Server error"
    });
  }
};


// ======================================================
// GET ALL SERVICES
// ======================================================

const getAllServices = async (req, res) => {
  try {
    const services = await Service.find()
      .populate(
        "categoryId",
        "name description status"
      )
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
    console.error(
      "GET ALL SERVICES ERROR:",
      error
    );

    return res.status(500).json({
      message: "Server error"
    });
  }
};


// ======================================================
// GET SERVICE BY ID
// ======================================================

const getServiceById = async (req, res) => {
  try {
    const service = await Service.findById(
      req.params.serviceId
    ).populate(
      "categoryId",
      "name description status"
    );

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
    console.error(
      "GET SERVICE BY ID ERROR:",
      error
    );

    return res.status(500).json({
      message: "Server error"
    });
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

    const service = await Service.findById(
      req.params.serviceId
    );

    if (!service) {
      return res.status(404).json({
        message: "Service not found"
      });
    }

    // --------------------------------------------------
    // SERVICE ID
    // --------------------------------------------------

    if (serviceId !== undefined) {

      if (
        typeof serviceId !== "string" ||
        !serviceId.trim()
      ) {
        return res.status(400).json({
          message: "Service ID cannot be empty"
        });
      }

      const duplicateService =
        await Service.findOne({
          serviceId: serviceId.trim(),
          _id: {
            $ne: service._id
          }
        });

      if (duplicateService) {
        return res.status(409).json({
          message: "Service ID already exists"
        });
      }

      service.serviceId =
        serviceId.trim();
    }


    // --------------------------------------------------
    // CATEGORY
    // --------------------------------------------------

    if (categoryId !== undefined) {

      const category =
        await Category.findById(
          categoryId
        );

      if (!category) {
        return res.status(404).json({
          message: "Category not found"
        });
      }

      service.categoryId =
        categoryId;
    }


    // --------------------------------------------------
    // PLATFORM
    // --------------------------------------------------

    if (platform !== undefined) {

      if (
        typeof platform !== "string" ||
        !platform.trim()
      ) {
        return res.status(400).json({
          message:
            "Platform cannot be empty"
        });
      }

      service.platform =
        platform.trim();
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
          message:
            "Service name cannot be empty"
        });
      }

      service.name =
        name.trim();
    }


    // --------------------------------------------------
    // DESCRIPTION
    // --------------------------------------------------

    if (description !== undefined) {

      service.description =
        typeof description === "string"
          ? description.trim()
          : "";
    }


    // --------------------------------------------------
    // PROVIDER
    // --------------------------------------------------

    if (providerId !== undefined) {

      service.providerId =
        providerId || null;
    }


    if (providerServiceId !== undefined) {

      service.providerServiceId =
        providerServiceId
          ? String(
              providerServiceId
            ).trim()
          : null;
    }


    // --------------------------------------------------
    // COST
    // --------------------------------------------------

    if (cost !== undefined) {

      const numericCost =
        Number(cost);

      if (
        !Number.isFinite(
          numericCost
        ) ||
        numericCost < 0
      ) {
        return res.status(400).json({
          message:
            "Cost must be a valid non-negative number"
        });
      }

      service.cost =
        numericCost;
    }


    // --------------------------------------------------
    // SELLING PRICE
    // --------------------------------------------------

    if (sellingPrice !== undefined) {

      const numericSellingPrice =
        Number(sellingPrice);

      if (
        !Number.isFinite(
          numericSellingPrice
        ) ||
        numericSellingPrice < 0
      ) {
        return res.status(400).json({
          message:
            "Selling price must be a valid non-negative number"
        });
      }

      service.sellingPrice =
        numericSellingPrice;
    }


    // --------------------------------------------------
    // MIN
    // --------------------------------------------------

    if (min !== undefined) {

      const numericMin =
        Number(min);

      if (
        !Number.isInteger(
          numericMin
        ) ||
        numericMin < 1
      ) {
        return res.status(400).json({
          message:
            "Minimum quantity must be at least 1"
        });
      }

      service.min =
        numericMin;
    }


    // --------------------------------------------------
    // MAX
    // --------------------------------------------------

    if (max !== undefined) {

      const numericMax =
        Number(max);

      if (
        !Number.isInteger(
          numericMax
        ) ||
        numericMax < 1
      ) {
        return res.status(400).json({
          message:
            "Maximum quantity must be at least 1"
        });
      }

      service.max =
        numericMax;
    }


    // --------------------------------------------------
    // MIN / MAX CHECK
    // --------------------------------------------------

    if (
      service.min >
      service.max
    ) {
      return res.status(400).json({
        message:
          "Minimum quantity cannot be greater than maximum quantity"
      });
    }


    // --------------------------------------------------
    // STATUS
    // --------------------------------------------------

    if (status !== undefined) {

      if (
        !["active", "inactive"]
          .includes(status)
      ) {
        return res.status(400).json({
          message:
            "Invalid status"
        });
      }

      service.status =
        status;
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
        numericSortOrder < 0
      ) {
        return res.status(400).json({
          message:
            "Sort order must be a valid non-negative number"
        });
      }

      service.sortOrder =
        numericSortOrder;
    }


    // --------------------------------------------------
    // FLAGS
    // --------------------------------------------------

    if (refill !== undefined) {
      service.refill =
        Boolean(refill);
    }

    if (cancel !== undefined) {
      service.cancel =
        Boolean(cancel);
    }

    if (dripFeed !== undefined) {
      service.dripFeed =
        Boolean(dripFeed);
    }


    // --------------------------------------------------
    // MARKUP TYPE
    // --------------------------------------------------

    if (markupType !== undefined) {

      if (
        !["fixed", "percentage"]
          .includes(markupType)
      ) {
        return res.status(400).json({
          message:
            "Invalid markup type"
        });
      }

      service.markupType =
        markupType;
    }


    // --------------------------------------------------
    // MARKUP VALUE
    // --------------------------------------------------

    if (markupValue !== undefined) {

      const numericMarkupValue =
        Number(markupValue);

      if (
        !Number.isFinite(
          numericMarkupValue
        ) ||
        numericMarkupValue < 0
      ) {
        return res.status(400).json({
          message:
            "Markup value must be a valid non-negative number"
        });
      }

      const currentMarkupType =
        markupType !== undefined
          ? markupType
          : service.markupType;

      if (
        currentMarkupType ===
          "percentage" &&
        numericMarkupValue > 100
      ) {
        return res.status(400).json({
          message:
            "Percentage markup cannot exceed 100"
        });
      }

      service.markupValue =
        numericMarkupValue;
    }


    // --------------------------------------------------
    // IMPORTED
    // --------------------------------------------------

    if (isImported !== undefined) {

      service.isImported =
        Boolean(isImported);
    }


    await service.save();

    return res.status(200).json({
      message:
        "Service updated successfully",
      service
    });

  } catch (error) {

    console.error(
      "UPDATE SERVICE ERROR:",
      error
    );

    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "Service ID already exists"
      });
    }

    return res.status(500).json({
      message:
        "Server error"
    });
  }
};


// ======================================================
// DELETE SERVICE
// ======================================================

const deleteService = async (req, res) => {
  try {

    const service =
      await Service.findById(
        req.params.serviceId
      );

    if (!service) {
      return res.status(404).json({
        message:
          "Service not found"
      });
    }

    await Service.findByIdAndDelete(
      req.params.serviceId
    );

    return res.status(200).json({
      message:
        "Service deleted successfully"
    });

  } catch (error) {

    console.error(
      "DELETE SERVICE ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Server error"
    });
  }
};


// ======================================================
// UPDATE SERVICE STATUS
// ======================================================

const updateServiceStatus = async (req, res) => {
  try {

    const { status } =
      req.body || {};

    if (
      !["active", "inactive"]
        .includes(status)
    ) {
      return res.status(400).json({
        message:
          "Status must be either active or inactive"
      });
    }

    const service =
      await Service.findById(
        req.params.serviceId
      );

    if (!service) {
      return res.status(404).json({
        message:
          "Service not found"
      });
    }

    service.status =
      status;

    await service.save();

    return res.status(200).json({
      message:
        "Service status updated successfully",
      service
    });

  } catch (error) {

    console.error(
      "UPDATE SERVICE STATUS ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Server error"
    });
  }
};


// ======================================================
// BULK PRICE UPDATE
// ======================================================

const bulkPriceUpdate = async (req, res) => {
  try {

    const {
      serviceIds,
      markupType,
      markupValue
    } = req.body || {};

    // --------------------------------------------------
    // VALIDATE SERVICE IDS
    // --------------------------------------------------

    if (
      !Array.isArray(serviceIds) ||
      serviceIds.length === 0
    ) {
      return res.status(400).json({
        message:
          "serviceIds must be a non-empty array"
      });
    }


    // --------------------------------------------------
    // VALIDATE MARKUP TYPE
    // --------------------------------------------------

    if (
      !["fixed", "percentage"]
        .includes(markupType)
    ) {
      return res.status(400).json({
        message:
          "Markup type must be fixed or percentage"
      });
    }


    // --------------------------------------------------
    // VALIDATE MARKUP VALUE
    // --------------------------------------------------

    const numericMarkupValue =
      Number(markupValue);

    if (
      !Number.isFinite(
        numericMarkupValue
      ) ||
      numericMarkupValue < 0
    ) {
      return res.status(400).json({
        message:
          "Markup value must be a valid non-negative number"
      });
    }

    if (
      markupType ===
        "percentage" &&
      numericMarkupValue > 100
    ) {
      return res.status(400).json({
        message:
          "Percentage markup cannot exceed 100"
      });
    }


    // --------------------------------------------------
    // FIND SERVICES
    // --------------------------------------------------

    const services =
      await Service.find({
        _id: {
          $in: serviceIds
        }
      });

    if (services.length === 0) {
      return res.status(404).json({
        message:
          "No services found"
      });
    }


    // --------------------------------------------------
    // UPDATE SELLING PRICE
    // --------------------------------------------------

    let updatedCount = 0;

    for (const service of services) {

      let newSellingPrice;

      if (
        markupType ===
        "fixed"
      ) {

        newSellingPrice =
          Number(service.cost) +
          numericMarkupValue;

      } else {

        newSellingPrice =
          Number(service.cost) +
          (
            Number(service.cost) *
            numericMarkupValue
          ) / 100;
      }

      service.sellingPrice =
        Number(
          newSellingPrice.toFixed(2)
        );

      service.markupType =
        markupType;

      service.markupValue =
        numericMarkupValue;

      await service.save();

      updatedCount++;
    }


    return res.status(200).json({
      message:
        "Bulk price update successful",

      updatedCount,

      markupType,

      markupValue:
        numericMarkupValue
    });

  } catch (error) {

    console.error(
      "BULK PRICE UPDATE ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Server error"
    });
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

  bulkPriceUpdate

};
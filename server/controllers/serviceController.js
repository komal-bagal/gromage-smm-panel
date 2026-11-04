const mongoose = require("mongoose");
const Service = require("../models/Service");

const getServices = async (req, res) => {
  try {
    const { category, provider, status, search } = req.query;
    const query = {};

    if (status && status !== "all") {
      const normalizedStatus =
        String(status).toLowerCase() === "disabled" ||
        String(status).toLowerCase() === "inactive"
          ? "inactive"
          : "active";
      query.status = normalizedStatus;
    }

    if (category && category !== "all") {
      if (mongoose.Types.ObjectId.isValid(category)) {
        query.$or = [{ categoryId: category }, { category: category }];
      } else {
        query.category = category;
      }
    }

    if (provider && provider !== "all") {
      if (mongoose.Types.ObjectId.isValid(provider)) {
        query.$or = [{ providerId: provider }, { provider: provider }];
      } else {
        query.provider = provider;
      }
    }

    if (search && String(search).trim()) {
      query.name = { $regex: String(search).trim(), $options: "i" };
    }

    const services = await Service.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      services,
    });
  } catch (error) {
    console.error("Get Services Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch services",
    });
  }
};

const getServiceById = async (req, res) => {
  try {
    const { serviceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    return res.status(200).json({
      success: true,
      service,
    });
  } catch (error) {
    console.error("Get Service By ID Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch service",
    });
  }
};

const createService = async (req, res) => {
  try {
    const {
      name,
      category,
      categoryId,
      provider,
      providerId,
      providerServiceId,
      cost,
      rate,
      price,
      min,
      minQuantity,
      max,
      maxQuantity,
      status,
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Service name is required",
      });
    }

    if (!category || !String(category).trim()) {
      return res.status(400).json({
        success: false,
        message: "Category is required",
      });
    }

    if (!provider || !String(provider).trim()) {
      return res.status(400).json({
        success: false,
        message: "Provider is required",
      });
    }

    const resolvedRate = Number(rate ?? price ?? 0);
    if (!Number.isFinite(resolvedRate) || resolvedRate < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid rate is required",
      });
    }

    const resolvedCost = Number(cost ?? 0);
    const resolvedMin = Number(min ?? minQuantity ?? 100);
    const resolvedMax = Number(max ?? maxQuantity ?? 10000);

    const normalizedStatus =
      String(status).toLowerCase() === "inactive" ||
      String(status).toLowerCase() === "disabled"
        ? "inactive"
        : "active";

    const newService = await Service.create({
      name: String(name).trim(),
      category: String(category).trim(),
      categoryId:
        categoryId && mongoose.Types.ObjectId.isValid(categoryId)
          ? categoryId
          : undefined,
      provider: String(provider).trim(),
      providerId:
        providerId && mongoose.Types.ObjectId.isValid(providerId)
          ? providerId
          : undefined,
      providerServiceId: providerServiceId
        ? String(providerServiceId).trim()
        : "",
      cost: Number.isFinite(resolvedCost) && resolvedCost >= 0 ? resolvedCost : 0,
      rate: resolvedRate,
      min: Number.isFinite(resolvedMin) && resolvedMin > 0 ? resolvedMin : 100,
      max: Number.isFinite(resolvedMax) && resolvedMax > 0 ? resolvedMax : 10000,
      status: normalizedStatus,
    });

    return res.status(201).json({
      success: true,
      service: newService,
      message: "Service created successfully",
    });
  } catch (error) {
    console.error("Create Service Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create service",
    });
  }
};

const updateService = async (req, res) => {
  try {
    const { serviceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    const updateData = {};
    const {
      name,
      category,
      categoryId,
      provider,
      providerId,
      providerServiceId,
      cost,
      rate,
      price,
      min,
      minQuantity,
      max,
      maxQuantity,
      status,
    } = req.body;

    if (name !== undefined) updateData.name = String(name).trim();
    if (category !== undefined) updateData.category = String(category).trim();
    if (categoryId !== undefined) {
      updateData.categoryId =
        categoryId && mongoose.Types.ObjectId.isValid(categoryId)
          ? categoryId
          : null;
    }
    if (provider !== undefined) updateData.provider = String(provider).trim();
    if (providerId !== undefined) {
      updateData.providerId =
        providerId && mongoose.Types.ObjectId.isValid(providerId)
          ? providerId
          : null;
    }
    if (providerServiceId !== undefined) {
      updateData.providerServiceId = String(providerServiceId).trim();
    }
    if (cost !== undefined) {
      const c = Number(cost);
      if (Number.isFinite(c) && c >= 0) updateData.cost = c;
    }
    if (rate !== undefined || price !== undefined) {
      const r = Number(rate ?? price);
      if (Number.isFinite(r) && r >= 0) updateData.rate = r;
    }
    if (min !== undefined || minQuantity !== undefined) {
      const m = Number(min ?? minQuantity);
      if (Number.isFinite(m) && m > 0) updateData.min = m;
    }
    if (max !== undefined || maxQuantity !== undefined) {
      const mx = Number(max ?? maxQuantity);
      if (Number.isFinite(mx) && mx > 0) updateData.max = mx;
    }
    if (status !== undefined) {
      updateData.status =
        String(status).toLowerCase() === "inactive" ||
        String(status).toLowerCase() === "disabled"
          ? "inactive"
          : "active";
    }

    const updatedService = await Service.findByIdAndUpdate(
      serviceId,
      updateData,
      {
        returnDocument: "after",
        runValidators: true,
      }
    );

    if (!updatedService) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    return res.status(200).json({
      success: true,
      service: updatedService,
      message: "Service updated successfully",
    });
  } catch (error) {
    console.error("Update Service Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update service",
    });
  }
};

const deleteService = async (req, res) => {
  try {
    const { serviceId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    const deletedService = await Service.findByIdAndDelete(serviceId);
    if (!deletedService) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Service deleted successfully",
    });
  } catch (error) {
    console.error("Delete Service Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete service",
    });
  }
};

const updateServiceStatus = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    const normalizedStatus =
      String(status).toLowerCase() === "inactive" ||
      String(status).toLowerCase() === "disabled"
        ? "inactive"
        : "active";

    const updatedService = await Service.findByIdAndUpdate(
      serviceId,
      { status: normalizedStatus },
      { returnDocument: "after" }
    );

    if (!updatedService) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    return res.status(200).json({
      success: true,
      service: updatedService,
      message: `Service marked as ${normalizedStatus}`,
    });
  } catch (error) {
    console.error("Update Service Status Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update service status",
    });
  }
};

const updateServiceProviderMapping = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { provider, providerId, providerServiceId, cost } = req.body;

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    const updateData = {};
    if (provider !== undefined) updateData.provider = String(provider).trim();
    if (providerId !== undefined) {
      updateData.providerId =
        providerId && mongoose.Types.ObjectId.isValid(providerId)
          ? providerId
          : null;
    }
    if (providerServiceId !== undefined) {
      updateData.providerServiceId = String(providerServiceId).trim();
    }
    if (cost !== undefined) {
      const c = Number(cost);
      if (Number.isFinite(c) && c >= 0) updateData.cost = c;
    }

    const updatedService = await Service.findByIdAndUpdate(
      serviceId,
      updateData,
      { returnDocument: "after" }
    );

    if (!updatedService) {
      return res.status(404).json({
        success: false,
        message: "Service not found",
      });
    }

    return res.status(200).json({
      success: true,
      service: updatedService,
      message: "Provider mapping updated successfully",
    });
  } catch (error) {
    console.error("Update Provider Mapping Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update provider mapping",
    });
  }
};

const bulkUpdateServicePrice = async (req, res) => {
  try {
    const { ids, serviceIds, priceType, type, value, percentage, amount } =
      req.body;
    const targetIds = Array.isArray(ids) ? ids : Array.isArray(serviceIds) ? serviceIds : [];

    if (targetIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one service ID is required",
      });
    }

    const numericValue = Number(value ?? percentage ?? amount);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid markup value is required",
      });
    }

    const isPercent =
      (priceType || type) === "percent" ||
      (priceType || type) === "percentage";

    const validObjectIds = targetIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (validObjectIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid service IDs provided",
      });
    }

    const services = await Service.find({ _id: { $in: validObjectIds } });

    const bulkOps = services.map((svc) => {
      let newRate = Number(svc.rate || 0);
      if (isPercent) {
        newRate = Number((newRate * (1 + numericValue / 100)).toFixed(2));
      } else {
        newRate = Number((newRate + numericValue).toFixed(2));
      }

      return {
        updateOne: {
          filter: { _id: svc._id },
          update: { $set: { rate: newRate } },
        },
      };
    });

    if (bulkOps.length > 0) {
      await Service.bulkWrite(bulkOps);
    }

    return res.status(200).json({
      success: true,
      count: bulkOps.length,
      message: `Bulk pricing updated for ${bulkOps.length} services`,
    });
  } catch (error) {
    console.error("Bulk Update Service Price Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to apply bulk pricing",
    });
  }
};

module.exports = {
  getServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  updateServiceStatus,
  updateServiceProviderMapping,
  bulkUpdateServicePrice,
};

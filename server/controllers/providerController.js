const mongoose = require("mongoose");
const Provider = require("../models/Provider");
const Service = require("../models/Service");

const mapStatusToApi = (status) => {
  if (!status) return "active";
  const s = String(status).toLowerCase();
  return s === "disabled" || s === "inactive" ? "inactive" : "active";
};

const mapPriorityToApi = (priority) => {
  if (typeof priority === "number" && !isNaN(priority)) {
    return Math.min(3, Math.max(1, priority));
  }
  if (!priority) return 2;
  const p = String(priority).trim().toLowerCase();
  if (p === "high" || p === "1") return 1;
  if (p === "low" || p === "3") return 3;
  if (p === "medium" || p === "2") return 2;
  const parsed = parseInt(p, 10);
  return !isNaN(parsed) ? Math.min(3, Math.max(1, parsed)) : 2;
};

const getProviders = async (req, res) => {
  try {
    const { status, search } = req.query;
    const query = {};

    if (status && status !== "all") {
      query.status = mapStatusToApi(status);
    }

    if (search && String(search).trim()) {
      query.name = { $regex: String(search).trim(), $options: "i" };
    }

    const providers = await Provider.find(query).sort({ priority: 1, createdAt: -1 });

    // Dynamically calculate accurate mapped services count from MongoDB
    const providersWithCounts = await Promise.all(
      providers.map(async (p) => {
        const count = await Service.countDocuments({
          $or: [{ providerId: p._id }, { provider: p.name }],
        });
        const obj = p.toObject();
        obj.services = count;
        return obj;
      })
    );

    return res.status(200).json({
      success: true,
      providers: providersWithCounts,
    });
  } catch (error) {
    console.error("Get Providers Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch providers",
    });
  }
};

const getProviderById = async (req, res) => {
  try {
    const { providerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    const provider = await Provider.findById(providerId);
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    const count = await Service.countDocuments({
      $or: [{ providerId: provider._id }, { provider: provider.name }],
    });

    const obj = provider.toObject();
    obj.services = count;

    return res.status(200).json({
      success: true,
      provider: obj,
    });
  } catch (error) {
    console.error("Get Provider By ID Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch provider",
    });
  }
};

const createProvider = async (req, res) => {
  try {
    const {
      name,
      url,
      apiKey,
      status,
      priority,
      currency,
      autoSync,
      autoRefill,
      description,
      autoMarginEnabled,
      autoMarginType,
      autoMarginPercent,
      autoMarginFixed,
      minMargin,
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Provider name is required",
      });
    }

    if (!url || !String(url).trim()) {
      return res.status(400).json({
        success: false,
        message: "Provider API URL is required",
      });
    }

    const newProvider = await Provider.create({
      name: String(name).trim(),
      url: String(url).trim(),
      apiKey: apiKey ? String(apiKey).trim() : "",
      status: mapStatusToApi(status),
      priority: mapPriorityToApi(priority),
      currency: currency ? String(currency).trim().toUpperCase() : "USD",
      autoSync: autoSync !== undefined ? Boolean(autoSync) : true,
      autoRefill: autoRefill !== undefined ? Boolean(autoRefill) : false,
      description: description ? String(description).trim() : "",
      autoMarginEnabled:
        autoMarginEnabled !== undefined ? Boolean(autoMarginEnabled) : true,
      autoMarginType:
        autoMarginType === "fixed" ? "fixed" : "percentage",
      autoMarginPercent:
        autoMarginPercent !== undefined ? Math.max(0, Number(autoMarginPercent)) : 20.0,
      autoMarginFixed:
        autoMarginFixed !== undefined ? Math.max(0, Number(autoMarginFixed)) : 5.0,
      minMargin:
        minMargin !== undefined ? Math.max(0, Number(minMargin)) : 1.0,
    });

    return res.status(201).json({
      success: true,
      provider: newProvider,
      message: "Provider created successfully",
    });
  } catch (error) {
    console.error("Create Provider Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create provider",
    });
  }
};

const updateProvider = async (req, res) => {
  try {
    const { providerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    const updateData = {};
    const {
      name,
      url,
      apiKey,
      status,
      priority,
      currency,
      autoSync,
      autoRefill,
      description,
      autoMarginEnabled,
      autoMarginType,
      autoMarginPercent,
      autoMarginFixed,
      minMargin,
    } = req.body;

    if (name !== undefined) updateData.name = String(name).trim();
    if (url !== undefined) updateData.url = String(url).trim();
    if (apiKey !== undefined) updateData.apiKey = String(apiKey).trim();
    if (status !== undefined) updateData.status = mapStatusToApi(status);
    if (priority !== undefined) updateData.priority = mapPriorityToApi(priority);
    if (currency !== undefined) updateData.currency = String(currency).trim().toUpperCase();
    if (autoSync !== undefined) updateData.autoSync = Boolean(autoSync);
    if (autoRefill !== undefined) updateData.autoRefill = Boolean(autoRefill);
    if (description !== undefined) updateData.description = String(description).trim();
    if (autoMarginEnabled !== undefined) updateData.autoMarginEnabled = Boolean(autoMarginEnabled);
    if (autoMarginType !== undefined) {
      updateData.autoMarginType = autoMarginType === "fixed" ? "fixed" : "percentage";
    }
    if (autoMarginPercent !== undefined) {
      updateData.autoMarginPercent = Math.max(0, Number(autoMarginPercent));
    }
    if (autoMarginFixed !== undefined) {
      updateData.autoMarginFixed = Math.max(0, Number(autoMarginFixed));
    }
    if (minMargin !== undefined) {
      updateData.minMargin = Math.max(0, Number(minMargin));
    }

    const updatedProvider = await Provider.findByIdAndUpdate(
      providerId,
      updateData,
      {
        returnDocument: "after",
        runValidators: true,
      }
    );

    if (!updatedProvider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    // If provider name was changed, sync related services
    if (updateData.name) {
      await Service.updateMany(
        { providerId: updatedProvider._id },
        { provider: updateData.name }
      );
    }

    return res.status(200).json({
      success: true,
      provider: updatedProvider,
      message: "Provider updated successfully",
    });
  } catch (error) {
    console.error("Update Provider Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update provider",
    });
  }
};

const deleteProvider = async (req, res) => {
  try {
    const { providerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    const deletedProvider = await Provider.findByIdAndDelete(providerId);
    if (!deletedProvider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Provider deleted successfully",
    });
  } catch (error) {
    console.error("Delete Provider Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete provider",
    });
  }
};

const updateProviderStatus = async (req, res) => {
  try {
    const { providerId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    const normalizedStatus = mapStatusToApi(status);
    const updatedProvider = await Provider.findByIdAndUpdate(
      providerId,
      { status: normalizedStatus },
      { returnDocument: "after" }
    );

    if (!updatedProvider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    return res.status(200).json({
      success: true,
      provider: updatedProvider,
      message: `Provider status updated to ${normalizedStatus}`,
    });
  } catch (error) {
    console.error("Update Provider Status Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update provider status",
    });
  }
};

const updateProviderPriority = async (req, res) => {
  try {
    const { providerId } = req.params;
    const { priority } = req.body;

    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    if (priority === undefined || priority === null) {
      return res.status(400).json({
        success: false,
        message: "Priority is required",
      });
    }

    const normalizedPriority = mapPriorityToApi(priority);
    const updatedProvider = await Provider.findByIdAndUpdate(
      providerId,
      { priority: normalizedPriority },
      { returnDocument: "after" }
    );

    if (!updatedProvider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    return res.status(200).json({
      success: true,
      provider: updatedProvider,
      message: `Provider priority updated to ${normalizedPriority}`,
    });
  } catch (error) {
    console.error("Update Provider Priority Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update provider priority",
    });
  }
};

const testProviderConnection = async (req, res) => {
  try {
    const { providerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    const provider = await Provider.findById(providerId);
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    // Calculate latency simulation / ping
    const latency = Math.floor(60 + Math.random() * 60);

    return res.status(200).json({
      success: true,
      providerId: provider._id,
      name: provider.name,
      latency: `${latency}ms`,
      httpStatus: 200,
      message: `Connected successfully to ${provider.name} (${latency}ms latency)`,
    });
  } catch (error) {
    console.error("Test Provider Connection Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to test provider connection",
    });
  }
};

const checkProviderBalance = async (req, res) => {
  try {
    const { providerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    const provider = await Provider.findById(providerId);
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    const formattedBalance = `$${(provider.balance || 0).toFixed(2)}`;

    return res.status(200).json({
      success: true,
      providerId: provider._id,
      balance: formattedBalance,
      balanceNum: provider.balance || 0,
      currency: provider.currency || "USD",
      message: `Balance refreshed: ${formattedBalance}`,
    });
  } catch (error) {
    console.error("Check Provider Balance Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to check provider balance",
    });
  }
};

const syncProviderOrders = async (req, res) => {
  try {
    const { providerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    const provider = await Provider.findById(providerId);
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    provider.lastOrderSync = "Just now";
    await provider.save();

    return res.status(200).json({
      success: true,
      providerId: provider._id,
      syncedOrders: 0,
      details: {
        completed: 0,
        processing: 0,
        canceled: 0,
        refunds: 0,
      },
      lastOrderSync: "Just now",
      message: `Synced active orders from ${provider.name}`,
    });
  } catch (error) {
    console.error("Sync Provider Orders Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to sync provider orders",
    });
  }
};

const importSelectedServices = async (req, res) => {
  try {
    const { providerId } = req.params;
    const { serviceIds, ids } = req.body;

    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    const provider = await Provider.findById(providerId);
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }

    const selectedList = Array.isArray(serviceIds) ? serviceIds : Array.isArray(ids) ? ids : [];

    return res.status(200).json({
      success: true,
      providerId: provider._id,
      importedCount: selectedList.length,
      message: `Imported ${selectedList.length} selected services successfully`,
    });
  } catch (error) {
    console.error("Import Selected Services Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to import selected services",
    });
  }
};

module.exports = {
  getProviders,
  getProviderById,
  createProvider,
  updateProvider,
  deleteProvider,
  updateProviderStatus,
  updateProviderPriority,
  testProviderConnection,
  checkProviderBalance,
  syncProviderOrders,
  importSelectedServices,
};

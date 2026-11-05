const Setting = require("../models/Setting");

// ======================================================
// GET PAYMENT SETTINGS
// ======================================================

const getPaymentSettings = async (req, res) => {
  try {
    let settings = await Setting.findOne({
      key: "payment"
    });

    // Create default settings if not found
    if (!settings) {
      settings = await Setting.create({
        key: "payment",
        payment: {
          upiEnabled: true,
          qrEnabled: true,
          manualPaymentEnabled: true,
          upiId: "",
          qrImage: "",
          instructions: ""
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payment settings fetched successfully",
      data: settings.payment
    });
  } catch (error) {
    console.error(
      "GET PAYMENT SETTINGS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment settings",
      error: error.message
    });
  }
};


// ======================================================
// UPDATE PAYMENT SETTINGS
// ======================================================

const updatePaymentSettings = async (req, res) => {
  try {
    const {
      upiEnabled,
      qrEnabled,
      manualPaymentEnabled,
      upiId,
      qrImage,
      instructions
    } = req.body || {};

    let settings = await Setting.findOne({
      key: "payment"
    });

    // Create settings if they don't exist
    if (!settings) {
      settings = new Setting({
        key: "payment"
      });
    }

    // Update only provided fields
    if (upiEnabled !== undefined) {
      settings.payment.upiEnabled = upiEnabled;
    }

    if (qrEnabled !== undefined) {
      settings.payment.qrEnabled = qrEnabled;
    }

    if (manualPaymentEnabled !== undefined) {
      settings.payment.manualPaymentEnabled =
        manualPaymentEnabled;
    }

    if (upiId !== undefined) {
      settings.payment.upiId = upiId;
    }

    if (qrImage !== undefined) {
      settings.payment.qrImage = qrImage;
    }

    if (instructions !== undefined) {
      settings.payment.instructions =
        instructions;
    }

    await settings.save();

    return res.status(200).json({
      success: true,
      message: "Payment settings updated successfully",
      data: settings.payment
    });
  } catch (error) {
    console.error(
      "UPDATE PAYMENT SETTINGS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update payment settings",
      error: error.message
    });
  }
};


// ======================================================
// GET INVOICE / GST SETTINGS
// ======================================================

const getInvoiceSettings = async (req, res) => {
  try {
    let settings = await Setting.findOne({
      key: "payment"
    });

    // Create settings if they don't exist
    if (!settings) {
      settings = new Setting({
        key: "payment"
      });

      await settings.save();
    }

    return res.status(200).json({
      success: true,
      message: "Invoice settings fetched successfully",
      data: settings.invoice
    });
  } catch (error) {
    console.error(
      "GET INVOICE SETTINGS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch invoice settings",
      error: error.message
    });
  }
};


// ======================================================
// UPDATE INVOICE / GST SETTINGS
// ======================================================

const updateInvoiceSettings = async (req, res) => {
  try {
    console.log(
      "INVOICE SETTINGS REQUEST BODY:",
      req.body
    );

    const {
      enabled,
      businessName,
      gstin,
      address,
      state,
      stateCode,
      gstRate,
      invoicePrefix,
      invoiceNumberStart,
      pdfEnabled
    } = req.body || {};

    let settings = await Setting.findOne({
      key: "payment"
    });

    // Create settings document if it doesn't exist
    if (!settings) {
      settings = new Setting({
        key: "payment"
      });
    }

    // Make sure invoice object exists
    if (!settings.invoice) {
      settings.invoice = {};
    }

    // ==================================================
    // UPDATE INVOICE SETTINGS
    // ==================================================

    if (enabled !== undefined) {
      settings.invoice.enabled = enabled;
    }

    if (businessName !== undefined) {
      settings.invoice.businessName =
        businessName;
    }

    if (gstin !== undefined) {
      settings.invoice.gstin = gstin;
    }

    if (address !== undefined) {
      settings.invoice.address = address;
    }

    if (state !== undefined) {
      settings.invoice.state = state;
    }

    if (stateCode !== undefined) {
      settings.invoice.stateCode =
        stateCode;
    }

    if (gstRate !== undefined) {
      settings.invoice.gstRate = gstRate;
    }

    if (invoicePrefix !== undefined) {
      settings.invoice.invoicePrefix =
        invoicePrefix;
    }

    if (invoiceNumberStart !== undefined) {
      settings.invoice.invoiceNumberStart =
        invoiceNumberStart;
    }

    if (pdfEnabled !== undefined) {
      settings.invoice.pdfEnabled =
        pdfEnabled;
    }

    // Tell Mongoose that nested invoice object changed
    settings.markModified("invoice");

    await settings.save();

    // Fetch again from MongoDB to verify saved values
    const updatedSettings =
      await Setting.findOne({
        key: "payment"
      });

    console.log(
      "SAVED INVOICE SETTINGS:",
      updatedSettings.invoice
    );

    return res.status(200).json({
      success: true,
      message: "Invoice settings updated successfully",
      data: updatedSettings.invoice
    });
  } catch (error) {
    console.error(
      "UPDATE INVOICE SETTINGS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update invoice settings",
      error: error.message
    });
  }
};


// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  getPaymentSettings,
  updatePaymentSettings,
  getInvoiceSettings,
  updateInvoiceSettings
};
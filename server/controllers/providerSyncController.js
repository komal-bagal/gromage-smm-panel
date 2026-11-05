
const mongoose = require("mongoose");

const {
  syncProviderServices
} = require("../services/providerSyncService");

// ======================================================
// SYNC PROVIDER SERVICES
// ======================================================

const syncServices = async (req, res) => {
  try {
    // --------------------------------------------------
    // GET PROVIDER ID
    // --------------------------------------------------

    const { providerId } = req.params;

    if (!providerId) {
      return res.status(400).json({
        success: false,
        message: "Provider ID is required"
      });
    }

    // --------------------------------------------------
    // VALIDATE PROVIDER ID
    // --------------------------------------------------

    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid provider ID"
      });
    }

    // --------------------------------------------------
    // AUTHENTICATION CHECK
    // --------------------------------------------------

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    // --------------------------------------------------
    // GET USER ROLE
    // --------------------------------------------------

    const userRole = String(
      req.user.role || ""
    ).toLowerCase();

    // --------------------------------------------------
    // ROLE CHECK
    // --------------------------------------------------

    if (
      userRole !== "admin" &&
      userRole !== "staff"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Only admin or staff can sync provider services"
      });
    }

    // --------------------------------------------------
    // START LOG
    // --------------------------------------------------

    console.log("====================================");
    console.log("PROVIDER SERVICE SYNC STARTED");
    console.log(
      "PROVIDER ID:",
      providerId
    );
    console.log(
      "REQUESTED BY:",
      req.user.email || req.user._id
    );
    console.log(
      "USER ROLE:",
      userRole
    );
    console.log("====================================");

    // --------------------------------------------------
    // CALL PROVIDER SYNC SERVICE
    // --------------------------------------------------

    const result =
      await syncProviderServices(providerId);

    // --------------------------------------------------
    // COMPLETION LOG
    // --------------------------------------------------

    console.log("====================================");
    console.log(
      "PROVIDER SERVICE SYNC COMPLETED"
    );

    console.log(
      "PROVIDER:",
      result.providerName
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

    console.log("====================================");

    // --------------------------------------------------
    // SUCCESS RESPONSE
    // --------------------------------------------------

    return res.status(200).json({
      success: true,

      message:
        "Provider services synchronized successfully",

      provider: {
        id: result.providerId,
        name: result.providerName
      },

      summary: {
        fetched: result.fetched,
        imported: result.imported,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed
      },

      services: result.services
    });

  } catch (error) {

    // --------------------------------------------------
    // ERROR LOG
    // --------------------------------------------------

    console.error("====================================");
    console.error(
      "PROVIDER SERVICE SYNC ERROR"
    );

    console.error(
      "MESSAGE:",
      error.message
    );

    console.error(
      "STACK:",
      error.stack
    );

    console.error("====================================");

    // --------------------------------------------------
    // ERROR RESPONSE
    // --------------------------------------------------

    return res.status(500).json({
      success: false,

      message:
        error.message ||
        "Provider service synchronization failed"
    });
  }
};

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  syncServices
};

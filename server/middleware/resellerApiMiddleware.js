const Reseller = require("../models/Reseller");

const MIN_KEY_LENGTH = 20;
const MAX_KEY_LENGTH = 200;
const LAST_USED_UPDATE_INTERVAL_MS = 60 * 1000;

const extractApiKey = (req) => {
  const candidate =
    req.headers["x-api-key"] ||
    req.headers["api-key"] ||
    req.body?.key ||
    req.body?.apiKey;

  // Must be a plain string. Objects such as {"$ne": null} are rejected
  // so they can never reach the database query.
  if (typeof candidate !== "string") {
    return null;
  }

  const key = candidate.trim();

  if (key.length < MIN_KEY_LENGTH || key.length > MAX_KEY_LENGTH) {
    return null;
  }

  return key;
};

const resellerApiMiddleware = async (req, res, next) => {
  try {
    const apiKey = extractApiKey(req);

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: "Valid reseller API key is required",
      });
    }

    // NOTE: no .select("+apiKey") - the key is only used as a filter,
    // so req.reseller never carries the key and cannot leak it.
    const reseller = await Reseller.findOne({ apiKey }).populate(
      "user",
      "name email role status"
    );

    if (!reseller) {
      return res.status(401).json({
        success: false,
        message: "Invalid reseller API key",
      });
    }

    if (!reseller.apiEnabled) {
      return res.status(403).json({
        success: false,
        message: "Reseller API is disabled",
      });
    }

    if (reseller.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Reseller account is not active",
      });
    }

    // The linked user must exist AND be active (a deleted user is blocked).
    if (!reseller.user || reseller.user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Reseller user account is not active",
      });
    }

    // Best-effort, throttled, atomic update. Never blocks or fails the request.
    const lastUsed = reseller.apiLastUsedAt
      ? reseller.apiLastUsedAt.getTime()
      : 0;

    if (Date.now() - lastUsed > LAST_USED_UPDATE_INTERVAL_MS) {
      Reseller.updateOne(
        { _id: reseller._id },
        { $set: { apiLastUsedAt: new Date() } }
      ).catch((error) =>
        console.error("RESELLER API LAST USED UPDATE ERROR:", error.message)
      );
    }

    req.reseller = reseller;

    return next();
  } catch (error) {
    console.error("RESELLER API AUTH ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: "Reseller API authentication failed",
    });
  }
};

module.exports = resellerApiMiddleware;
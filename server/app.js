
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const mongoose = require("mongoose");

// ======================================================
// ROUTES
// ======================================================

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const providerRoutes = require("./routes/providerRoutes");
const mockProviderRoutes = require("./routes/mockProviderRoutes");
const providerSyncRoutes = require("./routes/providerSyncRoutes");
const providerLogRoutes = require("./routes/providerLogRoutes");
const providerStatusRecoveryRoutes = require("./routes/providerStatusRecoveryRoutes");
const orderRoutes = require("./routes/orderRoutes");
const walletRoutes = require("./routes/walletRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const couponRoutes = require("./routes/couponRoutes");
const affiliateRoutes = require("./routes/affiliateRoutes");
const resellerRoutes = require("./routes/resellerRoutes");
const massOrderRoutes = require("./routes/massOrderRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const ticketRoutes = require("./routes/ticketRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const cmsSettingRoutes = require("./routes/cmsSettingRoutes");
const cmsPageRoutes = require("./routes/cmsPageRoutes");
const bannerRoutes = require("./routes/bannerRoutes");
const paymentMethodRoutes = require("./routes/paymentMethodRoutes");
const qrCodeRoutes = require("./routes/qrCodeRoutes");
const brandingRoutes = require("./routes/brandingRoutes");
const seoSettingRoutes = require("./routes/seoSettingRoutes");
const reportRoutes = require("./routes/reportRoutes");

// ======================================================
// APP
// ======================================================

const app = express();

// ======================================================
// SECURITY HEADERS
// ======================================================

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// ======================================================
// REQUEST / CORRELATION ID
// ======================================================

app.use((req, res, next) => {
  const incomingRequestId = req.headers["x-request-id"];

  const isValidRequestId =
    typeof incomingRequestId === "string" &&
    incomingRequestId.length <= 100 &&
    /^[a-zA-Z0-9._:-]+$/.test(incomingRequestId);

  const requestId = isValidRequestId
    ? incomingRequestId
    : crypto.randomUUID();

  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);

  next();
});

// ======================================================
// CORS
// ======================================================

// Keep the existing frontend origin.
// Add other trusted origins here only when required.
app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5175"],
    credentials: true,
  })
);

// ======================================================
// GLOBAL RATE LIMIT
// ======================================================

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

app.use(globalLimiter);

// ======================================================
// BODY PARSERS
// ======================================================

// Capture the original JSON bytes for payment webhook
// signature verification. Keep the existing JSON limit.
app.use(
  express.json({
    limit: "1mb",
    verify: (req, res, buf) => {
      req.rawBody = Buffer.from(buf);
    },
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  })
);

// ======================================================
// OTHER MIDDLEWARE
// ======================================================

app.use(cookieParser());
app.use(morgan("dev"));

// ======================================================
// STATIC UPLOADS
// ======================================================

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);

// ======================================================
// ROOT
// ======================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Gromage SMM Panel API is running",
    requestId: req.requestId,
  });
});

// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/health", (req, res) => {
  const mongoStatus =
    mongoose.connection.readyState === 1
      ? "connected"
      : "disconnected";

  const isHealthy = mongoStatus === "connected";

  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    status: isHealthy ? "healthy" : "unhealthy",
    service: "Gromage SMM Panel API",
    timestamp: new Date().toISOString(),
    dependencies: {
      mongodb: mongoStatus,
    },
    requestId: req.requestId,
  });
});

// ======================================================
// API ROUTES
// ======================================================

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/category", categoryRoutes);
app.use("/api/service", serviceRoutes);
app.use("/api/provider", providerRoutes);
app.use("/api/mock-provider", mockProviderRoutes);
app.use("/api/provider-sync", providerSyncRoutes);
app.use("/api/provider-logs", providerLogRoutes);

// Provider status recovery
app.use(
  "/api/provider-status-recovery",
  providerStatusRecoveryRoutes
);

app.use("/api/order", orderRoutes);
app.use("/api/mass-order", massOrderRoutes);
app.use("/api/wallet", walletRoutes);

// Payment endpoints:
// POST /api/payments/webhook
// POST /api/payments/paytm/callback
// A Cashfree webhook route will be added separately.
app.use("/api/payments", paymentRoutes);

app.use("/api/settings", settingsRoutes);
app.use("/api/coupon", couponRoutes);
app.use("/api/affiliate", affiliateRoutes);
app.use("/api/reseller", resellerRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/invoice", invoiceRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/cms-settings", cmsSettingRoutes);
app.use("/api/cms-pages", cmsPageRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/payment-methods", paymentMethodRoutes);
app.use("/api/qr-codes", qrCodeRoutes);
app.use("/api/branding", brandingRoutes);
app.use("/api/seo-settings", seoSettingRoutes);
app.use("/api/reports", reportRoutes);

// ======================================================
// 404 HANDLER
// ======================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    requestId: req.requestId,
  });
});

// ======================================================
// GLOBAL ERROR HANDLER
// ======================================================

app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err);

  const requestedStatus = Number(err.status || err.statusCode);

  const status =
    Number.isInteger(requestedStatus) &&
    requestedStatus >= 400 &&
    requestedStatus < 500
      ? requestedStatus
      : 500;

  res.status(status).json({
    success: false,
    message:
      status === 500
        ? "Internal server error"
        : err.expose === true
          ? err.message
          : "Request failed",
    requestId: req.requestId,
  });
});

// ======================================================
// EXPORT
// ======================================================

module.exports = app;

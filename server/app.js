const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const providerRoutes = require("./routes/providerRoutes");
const orderRoutes = require("./routes/orderRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const couponRoutes = require("./routes/couponRoutes");
const affiliateRoutes = require("./routes/affiliateRoutes");
const ticketRoutes = require("./routes/ticketRoutes");
const paymentSettingsRoutes = require("./routes/paymentSettingsRoutes");

const app = express();

const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "http://127.0.0.1:5176",
  "http://127.0.0.1:3000",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to Gromage SMM Panel API",
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/category", categoryRoutes);
app.use("/api/service", serviceRoutes);
app.use("/api/provider", providerRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/mass-order", orderRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/admin/dashboard", dashboardRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/admin/transactions", paymentRoutes);
app.use("/api/wallet", paymentRoutes);
app.use("/api/coupon", couponRoutes);
app.use("/api/affiliate", affiliateRoutes);
app.use("/api/ticket", ticketRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/settings/payment", paymentSettingsRoutes);

module.exports = app;

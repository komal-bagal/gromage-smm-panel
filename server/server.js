
require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

// ======================================================
// START SERVER
// ======================================================

const startServer = async () => {
  try {
    // 1. Connect to MongoDB first
    await connectDB();

    console.log("✅ MongoDB connection established.");

    // 2. Start cron jobs after database connection
    require("./cron/couponCleanup");
    require("./cron/providerStatusSync");

    // 3. Start background workers
    require("./workers/dripFeedWorker");
    require("./workers/providerStatusWorker");

    // 4. Start Express server
    const server = app.listen(PORT, () => {
      console.log(
        `🚀 Server is running on http://localhost:${PORT}`
      );
    });

    // 5. Handle server startup errors
    server.on("error", (error) => {
      console.error("❌ HTTP Server Error:", error.message);
      process.exit(1);
    });
  } catch (error) {
    console.error(
      "❌ Server startup failed:",
      error.message
    );

    process.exit(1);
  }
};

// ======================================================
// RUN APPLICATION
// ======================================================

startServer();

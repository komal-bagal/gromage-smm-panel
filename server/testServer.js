
require("dotenv").config();

const mongoose = require("mongoose");
const app = require("./app");
const connectDB = require("./config/db");

const PORT = 5001;

async function startTestServer() {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Test server requires NODE_ENV=test");
  }

  const uri = process.env.TEST_MONGODB_URI;

  if (!uri || !uri.includes("/gromage_smm_test")) {
    throw new Error(
      "Safety check failed: TEST_MONGODB_URI must target gromage_smm_test"
    );
  }

  await connectDB("Test Server");

  if (mongoose.connection.name !== "gromage_smm_test") {
    throw new Error("Safety check failed: connected to wrong database");
  }

  const server = app.listen(PORT, "127.0.0.1", () => {
    console.log(`Test API listening on http://127.0.0.1:${PORT}`);
  });

  server.on("error", (error) => {
    console.error("Test server error:", error.message);
    process.exitCode = 1;
  });
}

startTestServer().catch((error) => {
  console.error("Test server startup failed:", error.message);
  process.exitCode = 1;
});

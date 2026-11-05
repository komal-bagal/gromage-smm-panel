
const mongoose = require("mongoose");

const connectDB = async (label = "MongoDB") => {
  try {
    const mongoUri =
      process.env.NODE_ENV === "test"
        ? process.env.TEST_MONGODB_URI
        : process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error(
        process.env.NODE_ENV === "test"
          ? "TEST_MONGODB_URI is not configured"
          : "MONGO_URI is not configured"
      );
    }

    console.log(`${label}: Connecting to MongoDB...`);

    await mongoose.connect(mongoUri, {
      family: 4,
    });

    console.log(
      `${label} MongoDB Connected: ${mongoose.connection.name}`
    );
  } catch (err) {
    console.error(
      `${label} MongoDB Connection Error:`,
      err.message
    );

    process.exit(1);
  }
};

module.exports = connectDB;

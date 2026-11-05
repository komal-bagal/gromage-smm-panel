
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");

async function seedAdmin() {
  const { MONGO_URI, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!MONGO_URI || !ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      "Set MONGO_URI, ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD in the environment."
    );
  }

  if (ADMIN_PASSWORD.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters long.");
  }

  await mongoose.connect(MONGO_URI);

  const email = ADMIN_EMAIL.trim().toLowerCase();
  const existingUser = await User.findOne({ email });

  if (existingUser) {
    console.log(
      `Account ${email} already exists. No changes were made.`
    );
    return;
  }

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

  await User.create({
    name: ADMIN_NAME.trim(),
    email,
    password: hashedPassword,
    role: "admin",
    status: "active",
    balance: 0
  });

  console.log(`Admin account created successfully for ${email}.`);
}

seedAdmin()
  .catch((error) => {
    console.error("Admin seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });

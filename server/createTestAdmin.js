require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const readline = require("readline");
const User = require("./models/User");

async function main() {
  const uri = process.env.TEST_MONGODB_URI;
  if (!uri || !uri.includes("/gromage_smm_test")) {
    throw new Error("TEST DB guard failed; no changes made.");
  }

  await mongoose.connect(uri);
  if (mongoose.connection.name !== "gromage_smm_test") {
    throw new Error("Wrong database; no changes made.");
  }

  const email = "cancel.test.admin@example.com";
  const existing = await User.findOne({ email });
  if (existing) {
    console.log("Account already exists; no changes made.");
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const password = await new Promise(resolve => {
    rl.question("Enter a new test-only admin password (min 12 chars): ", answer => {
      rl.close();
      resolve(answer);
    });
  });

  if (!password || password.length < 12) {
    throw new Error("Password must be at least 12 characters; no account created.");
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  await User.create({
    name: "Cancellation Test Admin",
    email,
    password: hashedPassword,
    role: "admin",
    status: "active",
    balance: 0
  });

  console.log("Test admin created in gromage_smm_test:", email);
}

main()
  .catch(err => console.error("Stopped:", err.message))
  .finally(() => mongoose.disconnect());

require("dotenv").config();

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const BASE_URL = "http://localhost:5001";

// --------------------------------------------------
// TEST DATABASE AND TOKEN SETUP
// --------------------------------------------------

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const User = require("./models/User");
const PaymentTransaction = require("./models/PaymentTransaction");
const Wallet = require("./models/Wallet");
const WalletTransaction = require("./models/WalletTransaction");

const TEST_EMAIL = "api.test.user@example.com";

before(async () => {
  const uri = process.env.TEST_MONGODB_URI;

  if (!uri || !uri.includes("/gromage_smm_test")) {
    throw new Error(
      "Safety check failed: TEST_MONGODB_URI must target gromage_smm_test"
    );
  }

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET is missing or too short");
  }

  await mongoose.connect(uri);

  if (mongoose.connection.name !== "gromage_smm_test") {
    throw new Error(
      "Safety check failed: connected to the wrong database"
    );
  }

  for (const [email, role, key] of [
    ["api.test.user@example.com", "user", "TEST_USER_TOKEN"],
    ["api.test.admin@example.com", "admin", "TEST_ADMIN_TOKEN"]
  ]) {
    const user = await User.findOne({
      email,
      role,
      status: "active"
    })
      .select("_id")
      .lean();

    if (!user) {
      throw new Error("Missing active test account: " + email);
    }

    process.env[key] = jwt.sign(
      { userId: String(user._id) },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
        issuer: "gromage-smm-panel",
        audience: "gromage-client",
        algorithm: "HS256"
      }
    );
  }
});

after(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

// --------------------------------------------------
// RESELLER API TESTS
// --------------------------------------------------

test("Reseller balance API rejects requests without an API key", async () => {
  const response = await fetch(
    `${BASE_URL}/api/reseller/api/balance`
  );

  assert.equal(response.status, 401);
});

test("Reseller balance API rejects requests with an invalid API key", async () => {
  const response = await fetch(
    `${BASE_URL}/api/reseller/api/balance`,
    {
      headers: {
        "x-api-key": "invalid-test-key"
      }
    }
  );

  assert.equal(response.status, 401);
});

test("Reseller services API rejects requests without an API key", async () => {
  const response = await fetch(
    `${BASE_URL}/api/reseller/api/services`
  );

  assert.equal(response.status, 401);
});

test("Reseller order API rejects requests without an API key", async () => {
  const response = await fetch(
    `${BASE_URL}/api/reseller/api/order`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    }
  );

  assert.equal(response.status, 401);
});

// --------------------------------------------------
// ORDER DELETE API - AUTHENTICATION TESTS
// --------------------------------------------------

test("Order DELETE API rejects requests without authentication", async () => {
  const response = await fetch(
    `${BASE_URL}/api/order/000000000000000000000000`,
    {
      method: "DELETE"
    }
  );

  assert.equal(response.status, 401);
});

test("Order DELETE API rejects non-admin users", async (t) => {
  const userToken = process.env.TEST_USER_TOKEN;

  if (!userToken) {
    t.skip("TEST_USER_TOKEN is not set");
    return;
  }

  const response = await fetch(
    `${BASE_URL}/api/order/000000000000000000000000`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${userToken}`
      }
    }
  );

  assert.equal(response.status, 403);

  const body = await response.json();
  assert.equal(body.message, "Admin access required");
});

// --------------------------------------------------
// ORDER DELETE API - CONTROLLER TESTS
// --------------------------------------------------

test("Order DELETE API rejects an invalid order ID", async (t) => {
  const adminToken = process.env.TEST_ADMIN_TOKEN;

  if (!adminToken) {
    t.skip("TEST_ADMIN_TOKEN is not set");
    return;
  }

  const response = await fetch(
    `${BASE_URL}/api/order/invalid-order-id`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    }
  );

  assert.equal(response.status, 400);
});

test("Order DELETE API returns 404 for a nonexistent order", async (t) => {
  const adminToken = process.env.TEST_ADMIN_TOKEN;

  if (!adminToken) {
    t.skip("TEST_ADMIN_TOKEN is not set");
    return;
  }

  const response = await fetch(
    `${BASE_URL}/api/order/000000000000000000000000`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${adminToken}`
      }
    }
  );

  assert.equal(response.status, 404);
});

// --------------------------------------------------
// PAYMENT WEBHOOK - SECURITY TESTS
// --------------------------------------------------

test("Payment webhook rejects requests without a secret", async () => {
  const response = await fetch(
    `${BASE_URL}/api/payments/webhook`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        reference: "test-reference",
        status: "failed"
      })
    }
  );

  assert.equal(response.status, 401);
});

test("Payment webhook rejects an incorrect secret", async () => {
  const response = await fetch(
    `${BASE_URL}/api/payments/webhook`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-payment-webhook-secret": "definitely-wrong-test-secret"
      },
      body: JSON.stringify({
        reference: "test-reference",
        status: "failed"
      })
    }
  );

  assert.equal(response.status, 401);
});

// --------------------------------------------------
// PAYMENT WEBHOOK - VALID SECRET TESTS
// --------------------------------------------------

test("Payment webhook rejects a missing reference", async (t) => {
  const secret = process.env.TEST_PAYMENT_WEBHOOK_SECRET;

  if (!secret) {
    t.skip("TEST_PAYMENT_WEBHOOK_SECRET is not set");
    return;
  }

  const response = await fetch(
    `${BASE_URL}/api/payments/webhook`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-payment-webhook-secret": secret
      },
      body: JSON.stringify({
        status: "failed"
      })
    }
  );

  assert.equal(response.status, 400);
});

test("Payment webhook rejects an invalid payment status", async (t) => {
  const secret = process.env.TEST_PAYMENT_WEBHOOK_SECRET;

  if (!secret) {
    t.skip("TEST_PAYMENT_WEBHOOK_SECRET is not set");
    return;
  }

  const response = await fetch(
    `${BASE_URL}/api/payments/webhook`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-payment-webhook-secret": secret
      },
      body: JSON.stringify({
        reference: "test-reference",
        status: "pending"
      })
    }
  );

  assert.equal(response.status, 400);
});

test("Payment webhook returns 404 for an unknown payment reference", async (t) => {
  const secret = process.env.TEST_PAYMENT_WEBHOOK_SECRET;

  if (!secret) {
    t.skip("TEST_PAYMENT_WEBHOOK_SECRET is not set");
    return;
  }

  const response = await fetch(
    `${BASE_URL}/api/payments/webhook`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-payment-webhook-secret": secret
      },
      body: JSON.stringify({
        reference: "test-nonexistent-reference-987654321",
        status: "failed"
      })
    }
  );

  assert.equal(response.status, 404);
});

// --------------------------------------------------
// PAYMENT WEBHOOK - SUCCESS / IDEMPOTENCY TESTS
// --------------------------------------------------

const getWebhookSecret = (t) => {
  const secret = process.env.TEST_PAYMENT_WEBHOOK_SECRET;

  if (!secret) {
    t.skip("TEST_PAYMENT_WEBHOOK_SECRET is not set");
    return null;
  }

  return secret;
};

const makeTestReference = () =>
  `webhook-test-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;

const createPendingTestPayment = async (reference, amount = 125) => {
  const user = await User.findOne({
    email: TEST_EMAIL,
    role: "user",
    status: "active"
  })
    .select("_id")
    .lean();

  if (!user) {
    throw new Error("Missing active test user: " + TEST_EMAIL);
  }

  return PaymentTransaction.create({
    userId: user._id,
    paymentMethod: "upi",
    transactionType: "recharge",
    reference,
    amount,
    status: "pending"
  });
};

const sendCompletedWebhook = async (
  secret,
  reference,
  gatewayTransactionId
) => {
  const response = await fetch(
    `${BASE_URL}/api/payments/webhook`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-payment-webhook-secret": secret
      },
      body: JSON.stringify({
        reference,
        status: "completed",
        gatewayTransactionId
      })
    }
  );

  return {
    response,
    body: await response.json()
  };
};

// Save the original test-user balances so an unexpected credit
// can be cleaned up even if a security assertion fails.
const snapshotTestUserBalance = async (userId) => {
  const wallet = await Wallet.findOne({ userId }).lean();
  const user = await User.findById(userId)
    .select("balance")
    .lean();

  if (!user) {
    throw new Error(
      "Test user was not found while taking balance snapshot"
    );
  }

  return {
    walletExisted: Boolean(wallet),
    walletId: wallet ? wallet._id : null,
    walletBalance: wallet ? wallet.balance : 0,
    userBalance: user.balance
  };
};

const restoreTestUserBalance = async (userId, snapshot) => {
  const currentWallet = await Wallet.findOne({ userId }).lean();

  if (snapshot.walletExisted) {
    if (currentWallet) {
      await Wallet.updateOne(
        { _id: currentWallet._id },
        { $set: { balance: snapshot.walletBalance } }
      );
    }
  } else if (currentWallet) {
    await Wallet.deleteOne({ _id: currentWallet._id });
  }

  await User.updateOne(
    { _id: userId },
    { $set: { balance: snapshot.userBalance } }
  );
};

// --------------------------------------------------
// SECURITY TEST: UNVERIFIED UPI PAYMENT MUST NOT CREDIT
// --------------------------------------------------

test(
  "UPI completed webhook is rejected and does not credit the wallet",
  async (t) => {
    const secret = getWebhookSecret(t);
    if (!secret) return;

    const reference = makeTestReference();
    const gatewayTransactionId = `${reference}-gateway`;

    const payment = await createPendingTestPayment(reference, 125);
    const snapshot = await snapshotTestUserBalance(payment.userId);

    try {
      const result = await sendCompletedWebhook(
        secret,
        reference,
        gatewayTransactionId
      );

      assert.equal(result.response.status, 400);

      assert.match(
        result.body.message,
        /Automatic payment verification is not supported/
      );

      const savedPayment = await PaymentTransaction.findById(
        payment._id
      ).lean();

      assert.ok(savedPayment, "Payment record should still exist");
      assert.equal(savedPayment.status, "pending");
      assert.ok(
        !savedPayment.gatewayTransactionId,
        "Unverified gateway transaction ID must not be saved"
      );

      const walletAfter = await Wallet.findOne({
        userId: payment.userId
      }).lean();

      if (snapshot.walletExisted) {
        assert.ok(walletAfter, "Existing wallet should remain");
        assert.equal(
          walletAfter.balance,
          snapshot.walletBalance,
          "Rejected webhook must not change wallet balance"
        );
      } else {
        assert.equal(
          walletAfter,
          null,
          "Rejected webhook must not create a wallet"
        );
      }

      const userAfter = await User.findById(payment.userId)
        .select("balance")
        .lean();

      assert.equal(userAfter.balance, snapshot.userBalance);

      const ledger = await WalletTransaction.find({
        userId: payment.userId,
        reference,
        transactionType: "recharge"
      }).lean();

      assert.equal(
        ledger.length,
        0,
        "Rejected webhook must not create a recharge ledger entry"
      );
    } finally {
      await WalletTransaction.deleteMany({
        userId: payment.userId,
        reference
      });

      await PaymentTransaction.deleteOne({ _id: payment._id });

      await restoreTestUserBalance(payment.userId, snapshot);
    }
  }
);

// --------------------------------------------------
// SECURITY TEST: REPEATED UPI WEBHOOKS STAY BLOCKED
// --------------------------------------------------

test(
  "Repeated UPI completed webhooks cannot credit the wallet",
  async (t) => {
    const secret = getWebhookSecret(t);
    if (!secret) return;

    const reference = makeTestReference();
    const gatewayTransactionId = `${reference}-repeated`;

    const payment = await createPendingTestPayment(reference, 40);
    const snapshot = await snapshotTestUserBalance(payment.userId);

    try {
      const first = await sendCompletedWebhook(
        secret,
        reference,
        gatewayTransactionId
      );

      const second = await sendCompletedWebhook(
        secret,
        reference,
        gatewayTransactionId
      );

      assert.equal(first.response.status, 400);
      assert.equal(second.response.status, 400);

      const savedPayment = await PaymentTransaction.findById(
        payment._id
      ).lean();

      assert.equal(savedPayment.status, "pending");
      assert.ok(!savedPayment.gatewayTransactionId);

      const walletAfter = await Wallet.findOne({
        userId: payment.userId
      }).lean();

      if (snapshot.walletExisted) {
        assert.ok(walletAfter);
        assert.equal(walletAfter.balance, snapshot.walletBalance);
      } else {
        assert.equal(walletAfter, null);
      }

      const ledger = await WalletTransaction.find({
        userId: payment.userId,
        reference,
        transactionType: "recharge"
      }).lean();

      assert.equal(
        ledger.length,
        0,
        "Repeated unverified webhooks must never credit the wallet"
      );
    } finally {
      await WalletTransaction.deleteMany({
        userId: payment.userId,
        reference
      });

      await PaymentTransaction.deleteOne({ _id: payment._id });

      await restoreTestUserBalance(payment.userId, snapshot);
    }
  }
);

// --------------------------------------------------
// SECURITY TEST: CONCURRENT UPI WEBHOOKS STAY BLOCKED
// --------------------------------------------------

test(
  "Concurrent UPI completed webhooks cannot credit the wallet",
  async (t) => {
    const secret = getWebhookSecret(t);
    if (!secret) return;

    const reference = makeTestReference();
    const gatewayTransactionId = `${reference}-concurrent`;
    const amount = 73;

    const payment = await createPendingTestPayment(reference, amount);
    const snapshot = await snapshotTestUserBalance(payment.userId);

    try {
      const results = await Promise.all([
        sendCompletedWebhook(
          secret,
          reference,
          gatewayTransactionId
        ),
        sendCompletedWebhook(
          secret,
          reference,
          gatewayTransactionId
        )
      ]);

      for (const result of results) {
        assert.equal(
          result.response.status,
          400,
          `Expected unverified UPI webhook to be rejected. Body: ${
            JSON.stringify(result.body)
          }`
        );

        assert.match(
          result.body.message,
          /Automatic payment verification is not supported/
        );
      }

      const savedPayment = await PaymentTransaction.findById(
        payment._id
      ).lean();

      assert.ok(savedPayment);
      assert.equal(savedPayment.status, "pending");
      assert.ok(!savedPayment.gatewayTransactionId);

      const walletAfter = await Wallet.findOne({
        userId: payment.userId
      }).lean();

      if (snapshot.walletExisted) {
        assert.ok(walletAfter);
        assert.equal(
          walletAfter.balance,
          snapshot.walletBalance
        );
      } else {
        assert.equal(walletAfter, null);
      }

      const userAfter = await User.findById(payment.userId)
        .select("balance")
        .lean();

      assert.equal(userAfter.balance, snapshot.userBalance);

      const ledger = await WalletTransaction.find({
        userId: payment.userId,
        reference,
        transactionType: "recharge",
        status: "completed"
      }).lean();

      assert.equal(
        ledger.length,
        0,
        "Concurrent unverified webhooks must not create ledger entries"
      );
    } finally {
      await WalletTransaction.deleteMany({
        userId: payment.userId,
        reference
      });

      await PaymentTransaction.deleteOne({ _id: payment._id });

      await restoreTestUserBalance(payment.userId, snapshot);
    }
  }
);
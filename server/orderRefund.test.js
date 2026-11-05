require("dotenv").config();

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const User = require("./models/User");
const Wallet = require("./models/Wallet");
const WalletTransaction = require("./models/WalletTransaction");
const Order = require("./models/Order");
const Service = require("./models/Service");

const BASE_URL = "http://localhost:5001";

let user;
let order;
let wallet;
let token;
let refundReference;
let connectedByTest = false;

const concurrentFixtures = {
  user: null,
  wallet: null,
  order: null,
  refundReference: null
};

before(async () => {
  const uri = process.env.TEST_MONGODB_URI;
  const secret = process.env.JWT_SECRET;

  if (!uri || !uri.includes("/gromage_smm_test")) {
    throw new Error(
      "Safety check failed: test database URI is invalid."
    );
  }

  if (!secret || secret.length < 32) {
    throw new Error(
      "Safety check failed: JWT_SECRET is missing or too short."
    );
  }

  await mongoose.connect(uri);
  connectedByTest = true;

  if (mongoose.connection.name !== "gromage_smm_test") {
    throw new Error(
      "Safety check failed: connected to the wrong database."
    );
  }

  const service = await Service.findOne({
    _id: new mongoose.Types.ObjectId(
      "6ad1b7d612a171c9685676a9"
    ),
    status: "active",
    cancel: true
  }).lean();

  if (!service) {
    throw new Error(
      "The expected active cancellation test service was not found."
    );
  }

  const unique =
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  user = await User.create({
    name: "Automated Refund Retry Test",
    email: `refund.retry.automated.${unique}@example.com`,
    password: `TestOnly-${unique}-Password`,
    balance: 0,
    role: "user",
    status: "active"
  });

  order = await Order.create({
    userId: user._id,
    serviceId: service._id,
    link: "https://example.com/refund-retry-test",
    quantity: 1,
    charge: 25,
    status: "pending",
    cancel: true,
    providerOrderId: null,
    walletId: null
  });

  refundReference = `REFUND-${order._id}`;

  token = jwt.sign(
    { userId: String(user._id) },
    secret,
    {
      expiresIn: "1h",
      issuer: "gromage-smm-panel",
      audience: "gromage-client",
      algorithm: "HS256"
    }
  );
});

after(async () => {
  try {
    if (
      connectedByTest &&
      mongoose.connection.readyState === 1
    ) {
      // Clean up the main refund-retry test.
      if (order) {
        await WalletTransaction.deleteMany({
          reference: `REFUND-${order._id}`,
          transactionType: "refund"
        });

        await Order.deleteOne({
          _id: order._id
        });
      }

      if (user) {
        await Wallet.deleteMany({
          userId: user._id
        });

        await User.deleteOne({
          _id: user._id
        });
      }

      // Clean up the independent concurrency test.
      if (concurrentFixtures.order) {
        await WalletTransaction.deleteMany({
          reference: concurrentFixtures.refundReference,
          transactionType: "refund"
        });

        await Order.deleteOne({
          _id: concurrentFixtures.order._id
        });
      }

      if (concurrentFixtures.user) {
        await Wallet.deleteMany({
          userId: concurrentFixtures.user._id
        });

        await User.deleteOne({
          _id: concurrentFixtures.user._id
        });
      }
    }
  } finally {
    if (
      connectedByTest &&
      mongoose.connection.readyState !== 0
    ) {
      await mongoose.disconnect();
    }
  }
});

test(
  "cancellation refund can be retried after a missing wallet is fixed without duplicate credit",
  async () => {
    assert.ok(user, "Test user should have been created");
    assert.ok(order, "Test order should have been created");
    assert.ok(token, "Authentication token should have been created");

    // Attempt 1: the wallet does not exist, so refund must fail safely.
    const firstResponse = await fetch(
      `${BASE_URL}/api/order/${order._id}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    const firstBody = await firstResponse.json();

    assert.equal(
      firstResponse.status,
      500,
      JSON.stringify(firstBody)
    );

    assert.equal(firstBody.refunded, false);
    assert.equal(firstBody.retryable, true);

    let savedOrder = await Order.findById(order._id).lean();
    let savedUser = await User.findById(user._id).lean();

    assert.equal(savedOrder.status, "canceled");
    assert.equal(savedUser.balance, 0);

    let refundCount = await WalletTransaction.countDocuments({
      reference: refundReference,
      transactionType: "refund"
    });

    assert.equal(
      refundCount,
      0,
      "Failed attempt must not create a refund transaction"
    );

    // Repair the setup by creating the user's only wallet.
    wallet = await Wallet.create({
      userId: user._id,
      balance: 0,
      status: "active"
    });

    // Attempt 2: refund the same canceled order.
    const secondResponse = await fetch(
      `${BASE_URL}/api/order/${order._id}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    const secondBody = await secondResponse.json();

    assert.equal(
      secondResponse.status,
      200,
      JSON.stringify(secondBody)
    );

    assert.equal(secondBody.success, true);
    assert.equal(secondBody.refunded, true);

    savedOrder = await Order.findById(order._id).lean();
    savedUser = await User.findById(user._id).lean();

    let savedWallet = await Wallet.findById(wallet._id).lean();

    assert.equal(savedOrder.status, "refunded");
    assert.equal(savedUser.balance, 25);
    assert.equal(savedWallet.balance, 25);

    let completedRefundCount =
      await WalletTransaction.countDocuments({
        reference: refundReference,
        transactionType: "refund",
        amount: 25,
        status: "completed"
      });

    assert.equal(
      completedRefundCount,
      1,
      "Exactly one completed refund must exist"
    );

    // Attempt 3: a refunded order must not be refunded again.
    const thirdResponse = await fetch(
      `${BASE_URL}/api/order/${order._id}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    const thirdBody = await thirdResponse.json();

    assert.equal(
      thirdResponse.status,
      400,
      JSON.stringify(thirdBody)
    );

    assert.equal(thirdBody.success, false);

    assert.match(
      thirdBody.message,
      /cannot be canceled from status "refunded"/i
    );

    savedOrder = await Order.findById(order._id).lean();
    savedUser = await User.findById(user._id).lean();
    savedWallet = await Wallet.findById(wallet._id).lean();

    assert.equal(savedOrder.status, "refunded");
    assert.equal(savedUser.balance, 25);
    assert.equal(savedWallet.balance, 25);

    completedRefundCount =
      await WalletTransaction.countDocuments({
        reference: refundReference,
        transactionType: "refund",
        amount: 25,
        status: "completed"
      });

    assert.equal(
      completedRefundCount,
      1,
      "Retry must not create a duplicate refund transaction"
    );
  }
);

test(
  "concurrent cancellation requests must not duplicate a refund",
  async () => {
    assert.ok(token, "Main authentication token should exist");

    const secret = process.env.JWT_SECRET;

    const unique =
      `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    // Use a separate user so this test cannot collide with the
    // unique Wallet.userId index used by the first test.
    const concurrentUser = await User.create({
      name: "Automated Concurrent Refund Test",
      email: `refund.concurrent.${unique}@example.com`,
      password: `TestOnly-${unique}-Password`,
      balance: 0,
      role: "user",
      status: "active"
    });

    concurrentFixtures.user = concurrentUser;

    const concurrentToken = jwt.sign(
      { userId: String(concurrentUser._id) },
      secret,
      {
        expiresIn: "1h",
        issuer: "gromage-smm-panel",
        audience: "gromage-client",
        algorithm: "HS256"
      }
    );

    try {
      // This is the only wallet belonging to the concurrent test user.
      concurrentFixtures.wallet = await Wallet.create({
        userId: concurrentUser._id,
        balance: 0,
        status: "active"
      });

      concurrentFixtures.order = await Order.create({
        userId: concurrentUser._id,
        serviceId: order.serviceId,
        link: `https://example.com/concurrent-refund-${unique}`,
        quantity: 1,
        charge: 25,
        status: "pending",
        cancel: true,
        providerOrderId: null,
        walletId: concurrentFixtures.wallet._id
      });

      concurrentFixtures.refundReference =
        `REFUND-${concurrentFixtures.order._id}`;

      const makeCancellationRequest = () =>
        fetch(
          `${BASE_URL}/api/order/${concurrentFixtures.order._id}/cancel`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${concurrentToken}`,
              "Content-Type": "application/json"
            }
          }
        );

      // Fire both requests at nearly the same time.
      const responses = await Promise.all([
        makeCancellationRequest(),
        makeCancellationRequest()
      ]);

      const bodies = await Promise.all(
        responses.map((response) => response.json())
      );

      console.log(
        "Concurrent cancellation responses:",
        responses.map((response, index) => ({
          status: response.status,
          body: bodies[index]
        }))
      );

      const savedOrder = await Order.findById(
        concurrentFixtures.order._id
      ).lean();

      const savedWallet = await Wallet.findById(
        concurrentFixtures.wallet._id
      ).lean();

      const savedUser = await User.findById(
        concurrentUser._id
      ).lean();

      const completedRefunds = await WalletTransaction.find({
        reference: concurrentFixtures.refundReference,
        transactionType: "refund",
        status: "completed"
      }).lean();

      assert.equal(
        savedOrder.status,
        "refunded",
        "The order should finish in refunded status"
      );

      assert.equal(
        savedWallet.balance,
        25,
        "The wallet should receive exactly one refund"
      );

      assert.equal(
        savedUser.balance,
        25,
        "The user's balance should reflect exactly one refund"
      );

      assert.equal(
        completedRefunds.length,
        1,
        "Concurrent cancellation must create exactly one completed refund"
      );

      assert.ok(
        responses.some((response) => response.status === 200),
        "At least one cancellation request should succeed"
      );

      assert.ok(
        responses.every((response) =>
          [200, 400, 409].includes(response.status)
        ),
        "Unexpected cancellation response status"
      );
    } finally {
      // Clean up the test's refund transaction and order.
      if (concurrentFixtures.refundReference) {
        await WalletTransaction.deleteMany({
          reference: concurrentFixtures.refundReference,
          transactionType: "refund"
        });
      }

      if (concurrentFixtures.order) {
        await Order.deleteOne({
          _id: concurrentFixtures.order._id
        });
      }

      if (concurrentFixtures.wallet) {
        await Wallet.deleteOne({
          _id: concurrentFixtures.wallet._id
        });
      }

      if (concurrentFixtures.user) {
        await User.deleteOne({
          _id: concurrentFixtures.user._id
        });
      }

      concurrentFixtures.user = null;
      concurrentFixtures.wallet = null;
      concurrentFixtures.order = null;
      concurrentFixtures.refundReference = null;
    }
  }
);
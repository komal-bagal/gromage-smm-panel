require("dotenv").config();

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const cashfreeService = require("./services/cashfreeService");

const originalVerifySignature =
  cashfreeService.verifyCashfreeWebhookSignature;
const originalGetOrder = cashfreeService.getCashfreeOrder;
const originalGetPayments = cashfreeService.getCashfreePayments;

// Mock Cashfree functions before loading the controller.
// These tests never call the real Cashfree API.
let signatureIsValid = true;
let verifiedOrder;
let verifiedPayments;
let verificationError = null;
let orderCalls = 0;
let paymentsCalls = 0;

cashfreeService.verifyCashfreeWebhookSignature = () =>
  signatureIsValid;

cashfreeService.getCashfreeOrder = async () => {
  orderCalls++;

  if (verificationError) {
    throw verificationError;
  }

  return verifiedOrder;
};

cashfreeService.getCashfreePayments = async () => {
  paymentsCalls++;

  if (verificationError) {
    throw verificationError;
  }

  return verifiedPayments;
};

const { cashfreeWebhook } =
  require("./controllers/paymentController");

const User = require("./models/User");
const Wallet = require("./models/Wallet");
const WalletTransaction = require("./models/WalletTransaction");
const PaymentTransaction = require("./models/PaymentTransaction");

const TEST_AMOUNT = 50;
const BASE_BALANCE = 100;

let connectedByTest = false;
let sequence = 0;

const createdUserIds = [];
const createdOrderIds = [];

const makeUniqueId = () =>
  `cashfree-test-${Date.now()}-${++sequence}`;

const makeResponse = () => ({
  statusCode: 200,
  body: null,

  status(code) {
    this.statusCode = code;
    return this;
  },

  json(body) {
    this.body = body;
    return this;
  }
});

const resetMocks = () => {
  signatureIsValid = true;

  verifiedOrder = null;
  verifiedPayments = [];

  verificationError = null;

  orderCalls = 0;
  paymentsCalls = 0;
};

const createFixture = async () => {
  const uniqueId = makeUniqueId();
  const orderId = `CF-ORDER-${uniqueId}`;
  const reference = `CF-REF-${uniqueId}`;

  const user = await User.create({
    name: "Cashfree Webhook Test",
    email: `${uniqueId}@example.test`,
    password: "test-only-password",
    balance: BASE_BALANCE,
    role: "user",
    status: "active"
  });

  createdUserIds.push(user._id);

  await Wallet.create({
    userId: user._id,
    balance: BASE_BALANCE,
    status: "active"
  });

  const payment = await PaymentTransaction.create({
    userId: user._id,
    paymentMethod: "cashfree",
    transactionType: "recharge",
    reference,
    amount: TEST_AMOUNT,
    status: "pending",
    gatewayOrderId: orderId
  });

  createdOrderIds.push(orderId);

  return { user, payment, orderId, reference };
};

const configureVerifiedSuccess = (orderId, overrides = {}) => {
  verifiedOrder = {
    order_id: orderId,
    order_status: "PAID",
    order_amount: TEST_AMOUNT,
    order_currency: "INR",
    ...overrides.order
  };

  verifiedPayments = [
    {
      cf_payment_id: `CF-PAY-${orderId}`,
      payment_status: "SUCCESS",
      payment_amount: TEST_AMOUNT,
      ...(overrides.payment || {})
    }
  ];
};

const makeWebhookBody = (orderId, overrides = {}) => ({
  type: "PAYMENT_SUCCESS_WEBHOOK",
  data: {
    order: {
      order_id: orderId
    },
    payment: {
      cf_payment_id: `CF-PAY-${orderId}`,
      payment_status: "SUCCESS",
      payment_amount: TEST_AMOUNT,
      ...(overrides.payment || {})
    }
  }
});

const callWebhook = async (body, options = {}) => {
  const rawBody = Buffer.from(JSON.stringify(body));

  const req = {
    body,
    rawBody,
    headers: {
      "x-webhook-signature": "test-signature",
      "x-webhook-timestamp": "test-timestamp",
      ...(options.headers || {})
    },
    requestId: "cashfree-webhook-test"
  };

  // Use hasOwnProperty so explicitly supplied undefined/null values
  // can simulate a missing raw body in tests.
  if (Object.prototype.hasOwnProperty.call(options, "rawBody")) {
    req.rawBody = options.rawBody;
  }

  const res = makeResponse();

  await cashfreeWebhook(req, res);

  return res;
};

const assertBalancesUnchanged = async (userId, reference) => {
  const wallet = await Wallet.findOne({ userId });
  const user = await User.findById(userId);

  const ledgerCount = await WalletTransaction.countDocuments({
    userId,
    reference,
    transactionType: "recharge"
  });

  assert.ok(wallet, "Expected test wallet to exist");
  assert.ok(user, "Expected test user to exist");
  assert.equal(wallet.balance, BASE_BALANCE);
  assert.equal(user.balance, BASE_BALANCE);
  assert.equal(ledgerCount, 0);
};

before(async () => {
  const uri = process.env.TEST_MONGODB_URI;

  if (!uri || !uri.includes("/gromage_smm_test")) {
    throw new Error(
      "Safety check failed: TEST_MONGODB_URI must target gromage_smm_test."
    );
  }

  await mongoose.connect(uri);
  connectedByTest = true;

  if (mongoose.connection.name !== "gromage_smm_test") {
    throw new Error(
      "Safety check failed: connected to the wrong database."
    );
  }

  const hello = await mongoose.connection.db.admin().command({
    hello: 1
  });

  if (!hello.setName) {
    throw new Error(
      "Safety check failed: MongoDB transactions require a replica set."
    );
  }
});

after(async () => {
  try {
    if (connectedByTest && mongoose.connection.readyState === 1) {
      if (createdUserIds.length) {
        await WalletTransaction.deleteMany({
          userId: { $in: createdUserIds }
        });

        await Wallet.deleteMany({
          userId: { $in: createdUserIds }
        });

        await PaymentTransaction.deleteMany({
          userId: { $in: createdUserIds }
        });

        await User.deleteMany({
          _id: { $in: createdUserIds }
        });
      }

      if (createdOrderIds.length) {
        await PaymentTransaction.deleteMany({
          gatewayOrderId: { $in: createdOrderIds }
        });
      }
    }
  } finally {
    cashfreeService.verifyCashfreeWebhookSignature =
      originalVerifySignature;

    cashfreeService.getCashfreeOrder = originalGetOrder;
    cashfreeService.getCashfreePayments = originalGetPayments;

    resetMocks();

    if (connectedByTest && mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
});

test("invalid webhook signature is rejected without gateway calls", async () => {
  resetMocks();
  signatureIsValid = false;

  const body = makeWebhookBody("CF-INVALID-SIGNATURE");
  const res = await callWebhook(body);

  assert.equal(res.statusCode, 401);
  assert.match(res.body.message, /invalid cashfree webhook signature/i);

  assert.equal(orderCalls, 0);
  assert.equal(paymentsCalls, 0);
});

test("missing raw body is rejected", async () => {
  resetMocks();

  const body = makeWebhookBody("CF-MISSING-RAW-BODY");

  const res = await callWebhook(body, {
    rawBody: null
  });

  assert.equal(res.statusCode, 400);
  assert.match(
    res.body.message,
    /webhook raw body is unavailable/i
  );

  assert.equal(orderCalls, 0);
  assert.equal(paymentsCalls, 0);
});

test("non-success event is acknowledged without wallet credit", async () => {
  resetMocks();

  const res = await callWebhook({
    type: "PAYMENT_FAILED_WEBHOOK",
    data: {}
  });

  assert.equal(res.statusCode, 200);
  assert.equal(orderCalls, 0);
  assert.equal(paymentsCalls, 0);
});

test("successful verified webhook credits wallet and creates one ledger entry", async () => {
  resetMocks();

  const { user, payment, orderId, reference } =
    await createFixture();

  configureVerifiedSuccess(orderId);

  const res = await callWebhook(makeWebhookBody(orderId));

  assert.equal(res.statusCode, 200);
  assert.match(
    res.body.message,
    /cashfree payment verified and wallet credited successfully/i
  );

  const updatedPayment =
    await PaymentTransaction.findById(payment._id);

  const updatedWallet =
    await Wallet.findOne({ userId: user._id });

  const updatedUser =
    await User.findById(user._id);

  const ledgerEntries = await WalletTransaction.find({
    userId: user._id,
    reference,
    transactionType: "recharge"
  });

  assert.equal(updatedPayment.status, "completed");
  assert.equal(
    updatedPayment.gatewayTransactionId,
    `CF-PAY-${orderId}`
  );

  assert.equal(updatedWallet.balance, BASE_BALANCE + TEST_AMOUNT);
  assert.equal(updatedUser.balance, BASE_BALANCE + TEST_AMOUNT);

  assert.equal(ledgerEntries.length, 1);
  assert.equal(ledgerEntries[0].amount, TEST_AMOUNT);
  assert.equal(ledgerEntries[0].balanceBefore, BASE_BALANCE);
  assert.equal(
    ledgerEntries[0].balanceAfter,
    BASE_BALANCE + TEST_AMOUNT
  );
  assert.equal(ledgerEntries[0].status, "completed");

  assert.equal(orderCalls, 1);
  assert.equal(paymentsCalls, 1);
});

test("duplicate webhook does not credit wallet a second time", async () => {
  resetMocks();

  const { user, payment, orderId, reference } =
    await createFixture();

  configureVerifiedSuccess(orderId);

  const firstResponse =
    await callWebhook(makeWebhookBody(orderId));

  assert.equal(firstResponse.statusCode, 200);

  const secondResponse =
    await callWebhook(makeWebhookBody(orderId));

  assert.equal(secondResponse.statusCode, 200);
  assert.match(
    secondResponse.body.message,
    /already completed/i
  );

  const updatedPayment =
    await PaymentTransaction.findById(payment._id);

  const updatedWallet =
    await Wallet.findOne({ userId: user._id });

  const updatedUser =
    await User.findById(user._id);

  const ledgerCount = await WalletTransaction.countDocuments({
    userId: user._id,
    reference,
    transactionType: "recharge"
  });

  assert.equal(updatedPayment.status, "completed");
  assert.equal(updatedWallet.balance, BASE_BALANCE + TEST_AMOUNT);
  assert.equal(updatedUser.balance, BASE_BALANCE + TEST_AMOUNT);
  assert.equal(ledgerCount, 1);

  // A completed payment should not trigger another gateway lookup.
  assert.equal(orderCalls, 1);
  assert.equal(paymentsCalls, 1);
});

test("unsuccessful payment status does not credit wallet", async () => {
  resetMocks();

  const { user, orderId, reference } = await createFixture();

  const body = makeWebhookBody(orderId, {
    payment: { payment_status: "FAILED" }
  });

  const res = await callWebhook(body);

  assert.equal(res.statusCode, 200);
  assert.match(res.body.message, /not successful/i);

  await assertBalancesUnchanged(user._id, reference);

  assert.equal(orderCalls, 0);
  assert.equal(paymentsCalls, 0);
});

test("webhook amount mismatch does not credit wallet", async () => {
  resetMocks();

  const { user, payment, orderId, reference } =
    await createFixture();

  configureVerifiedSuccess(orderId);

  const body = makeWebhookBody(orderId, {
    payment: { payment_amount: 99 }
  });

  const res = await callWebhook(body);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /payment amount mismatch/i);

  const updatedPayment =
    await PaymentTransaction.findById(payment._id);

  assert.equal(updatedPayment.status, "pending");

  await assertBalancesUnchanged(user._id, reference);
});

test("Cashfree API verification error leaves payment pending", async () => {
  resetMocks();

  const { user, payment, orderId, reference } =
    await createFixture();

  verificationError = new Error(
    "Simulated Cashfree verification failure"
  );

  const res = await callWebhook(makeWebhookBody(orderId));

  assert.equal(res.statusCode, 502);
  assert.match(
    res.body.message,
    /unable to verify cashfree payment/i
  );

  const updatedPayment =
    await PaymentTransaction.findById(payment._id);

  assert.equal(updatedPayment.status, "pending");

  await assertBalancesUnchanged(user._id, reference);
});

test("verified order amount mismatch does not credit wallet", async () => {
  resetMocks();

  const { user, payment, orderId, reference } =
    await createFixture();

  configureVerifiedSuccess(orderId, {
    order: { order_amount: 99 }
  });

  const res = await callWebhook(makeWebhookBody(orderId));

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /order amount mismatch/i);

  const updatedPayment =
    await PaymentTransaction.findById(payment._id);

  assert.equal(updatedPayment.status, "pending");

  await assertBalancesUnchanged(user._id, reference);
});

test("verified Cashfree payment amount mismatch does not credit wallet", async () => {
  resetMocks();

  const { user, payment, orderId, reference } =
    await createFixture();

  configureVerifiedSuccess(orderId);

  verifiedPayments[0].payment_amount = 99;

  const res = await callWebhook(makeWebhookBody(orderId));

  assert.equal(res.statusCode, 400);
  assert.match(
    res.body.message,
    /verified cashfree payment amount mismatch/i
  );

  const updatedPayment =
    await PaymentTransaction.findById(payment._id);

  assert.equal(updatedPayment.status, "pending");

  await assertBalancesUnchanged(user._id, reference);
});
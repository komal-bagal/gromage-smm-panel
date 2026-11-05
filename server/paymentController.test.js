
require("dotenv").config();

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const paytmService = require("./services/paytmService");
const originalGetPaytmTransactionStatus =
  paytmService.getPaytmTransactionStatus;

// Mock Paytm before loading the controller because it imports this
// function directly. No real Paytm API requests will be made.
const verifiedResponses = new Map();
const verificationErrors = new Map();

paytmService.getPaytmTransactionStatus = async (orderId) => {
  if (verificationErrors.has(orderId)) {
    throw verificationErrors.get(orderId);
  }

  if (!verifiedResponses.has(orderId)) {
    throw new Error("No mocked Paytm response configured for this test");
  }

  return verifiedResponses.get(orderId);
};

const { paytmCallback } = require("./controllers/paymentController");

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
  `paytm-test-${Date.now()}-${++sequence}`;

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

const callCallback = async (body) => {
  const req = {
    body,
    requestId: "payment-controller-test"
  };

  const res = makeResponse();

  await paytmCallback(req, res);

  return res;
};

const createFixture = async () => {
  const uniqueId = makeUniqueId();
  const orderId = `ORDER-${uniqueId}`;
  const reference = `REF-${uniqueId}`;

  const user = await User.create({
    name: "Paytm Callback Test",
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
    paymentMethod: "paytm",
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
  verifiedResponses.set(orderId, {
    status: "TXN_SUCCESS",
    txnId: `TXN-${orderId}`,
    txnAmount: String(TEST_AMOUNT),
    resultCode: "01",
    resultMessage: "Txn Success",
    ...overrides
  });
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
    throw new Error("Safety check failed: connected to the wrong database.");
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

      // Also remove any test payments created for gateway-ID reuse checks.
      if (createdOrderIds.length) {
        await PaymentTransaction.deleteMany({
          gatewayOrderId: { $in: createdOrderIds }
        });
      }
    }
  } finally {
    paytmService.getPaytmTransactionStatus =
      originalGetPaytmTransactionStatus;

    verifiedResponses.clear();
    verificationErrors.clear();

    if (connectedByTest && mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
});

test("verified success credits the wallet and creates one recharge ledger entry", async () => {
  const { user, payment, orderId, reference } = await createFixture();

  configureVerifiedSuccess(orderId);

  const res = await callCallback({
    ORDERID: orderId,
    STATUS: "TXN_FAILURE",
    TXNID: "UNTRUSTED-CALLBACK-TXN"
  });

  assert.equal(res.statusCode, 200);
  assert.match(res.body.message, /verified and wallet credited successfully/i);

  const updatedPayment = await PaymentTransaction.findById(payment._id);
  const updatedWallet = await Wallet.findOne({ userId: user._id });
  const updatedUser = await User.findById(user._id);

  const ledgerEntries = await WalletTransaction.find({
    userId: user._id,
    reference,
    transactionType: "recharge"
  });

  assert.equal(updatedPayment.status, "completed");
  assert.equal(updatedPayment.gatewayTransactionId, `TXN-${orderId}`);
  assert.equal(updatedWallet.balance, BASE_BALANCE + TEST_AMOUNT);
  assert.equal(updatedUser.balance, BASE_BALANCE + TEST_AMOUNT);
  assert.equal(ledgerEntries.length, 1);
  assert.equal(ledgerEntries[0].amount, TEST_AMOUNT);
  assert.equal(ledgerEntries[0].balanceBefore, BASE_BALANCE);
  assert.equal(ledgerEntries[0].balanceAfter, BASE_BALANCE + TEST_AMOUNT);
  assert.equal(ledgerEntries[0].status, "completed");
});

test("duplicate callback does not credit the wallet a second time", async () => {
  const { user, payment, orderId, reference } = await createFixture();

  configureVerifiedSuccess(orderId);

  const firstResponse = await callCallback({ ORDERID: orderId });
  assert.equal(firstResponse.statusCode, 200);

  const secondResponse = await callCallback({ ORDERID: orderId });

  assert.equal(secondResponse.statusCode, 200);
  assert.match(secondResponse.body.message, /already completed/i);

  const updatedPayment = await PaymentTransaction.findById(payment._id);
  const updatedWallet = await Wallet.findOne({ userId: user._id });
  const updatedUser = await User.findById(user._id);

  const ledgerCount = await WalletTransaction.countDocuments({
    userId: user._id,
    reference,
    transactionType: "recharge"
  });

  assert.equal(updatedPayment.status, "completed");
  assert.equal(updatedWallet.balance, BASE_BALANCE + TEST_AMOUNT);
  assert.equal(updatedUser.balance, BASE_BALANCE + TEST_AMOUNT);
  assert.equal(ledgerCount, 1);
});

test("verified amount mismatch fails the payment without crediting the wallet", async () => {
  const { user, payment, orderId, reference } = await createFixture();

  configureVerifiedSuccess(orderId, {
    txnAmount: "99.00"
  });

  const res = await callCallback({ ORDERID: orderId });

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /amount mismatch/i);

  const updatedPayment = await PaymentTransaction.findById(payment._id);
  const updatedWallet = await Wallet.findOne({ userId: user._id });
  const updatedUser = await User.findById(user._id);

  const ledgerCount = await WalletTransaction.countDocuments({
    userId: user._id,
    reference,
    transactionType: "recharge"
  });

  assert.equal(updatedPayment.status, "failed");
  assert.equal(updatedWallet.balance, BASE_BALANCE);
  assert.equal(updatedUser.balance, BASE_BALANCE);
  assert.equal(ledgerCount, 0);
});

test("Paytm verification error leaves the payment pending and wallet unchanged", async () => {
  const { user, payment, orderId, reference } = await createFixture();

  verificationErrors.set(orderId, new Error("Simulated verification failure"));

  const res = await callCallback({ ORDERID: orderId });

  assert.equal(res.statusCode, 502);
  assert.match(res.body.message, /unable to verify paytm payment/i);

  const updatedPayment = await PaymentTransaction.findById(payment._id);
  const updatedWallet = await Wallet.findOne({ userId: user._id });
  const updatedUser = await User.findById(user._id);

  const ledgerCount = await WalletTransaction.countDocuments({
    userId: user._id,
    reference,
    transactionType: "recharge"
  });

  assert.equal(updatedPayment.status, "pending");
  assert.equal(updatedWallet.balance, BASE_BALANCE);
  assert.equal(updatedUser.balance, BASE_BALANCE);
  assert.equal(ledgerCount, 0);
});

test("gateway transaction ID already used by another payment is rejected", async () => {
  const { user, payment, orderId, reference } = await createFixture();

  const reusedTxnId = `TXN-ALREADY-USED-${orderId}`;

  const otherOrderId = `OTHER-${orderId}`;
  createdOrderIds.push(otherOrderId);

  await PaymentTransaction.create({
    userId: user._id,
    paymentMethod: "paytm",
    transactionType: "recharge",
    reference: `OTHER-${reference}`,
    amount: TEST_AMOUNT,
    status: "completed",
    gatewayOrderId: otherOrderId,
    gatewayTransactionId: reusedTxnId
  });

  configureVerifiedSuccess(orderId, {
    txnId: reusedTxnId
  });

  const res = await callCallback({ ORDERID: orderId });

  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /gateway transaction already used/i);

  const updatedPayment = await PaymentTransaction.findById(payment._id);
  const updatedWallet = await Wallet.findOne({ userId: user._id });
  const updatedUser = await User.findById(user._id);

  const ledgerCount = await WalletTransaction.countDocuments({
    userId: user._id,
    reference,
    transactionType: "recharge"
  });

  assert.equal(updatedPayment.status, "pending");
  assert.equal(updatedWallet.balance, BASE_BALANCE);
  assert.equal(updatedUser.balance, BASE_BALANCE);
  assert.equal(ledgerCount, 0);
});

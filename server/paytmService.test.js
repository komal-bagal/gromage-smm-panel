
const test = require("node:test");
const assert = require("node:assert/strict");

const axios = require("axios");
const PaytmChecksum = require("paytmchecksum");

// --------------------------------------------------
// TEST-ONLY PAYTM CONFIGURATION
// Set environment variables BEFORE importing the service.
// These are dummy values; no real Paytm gateway is called.
// --------------------------------------------------

process.env.PAYTM_MID = "TESTMID";
process.env.PAYTM_MERCHANT_KEY = "1234567890123456";
process.env.PAYTM_CALLBACK_URL = "http://localhost/callback";
process.env.PAYTM_ENVIRONMENT = "staging";

// --------------------------------------------------
// IMPORT SERVICE AFTER CONFIGURATION
// --------------------------------------------------

const {
  generatePaytmOrderId,
  formatAmount,
  getPaytmTransactionStatus
} = require("./services/paytmService");

// --------------------------------------------------
// FORMAT AMOUNT TESTS
// --------------------------------------------------

test("formats a whole amount to two decimal places", () => {
  assert.equal(formatAmount(100), "100.00");
});

test("formats a decimal amount to two decimal places", () => {
  assert.equal(formatAmount(99.5), "99.50");
});

test("rejects zero amount", () => {
  assert.throws(() => formatAmount(0));
});

test("rejects negative amount", () => {
  assert.throws(() => formatAmount(-10));
});

test("rejects non-numeric amount", () => {
  assert.throws(() => formatAmount("invalid"));
});

// --------------------------------------------------
// ORDER ID TESTS
// --------------------------------------------------

test("generates a Paytm order ID", () => {
  const orderId = generatePaytmOrderId("test-reference-123");

  assert.equal(typeof orderId, "string");
  assert.ok(orderId.length > 0);
});

test("generates an order ID within Paytm length limit", () => {
  const orderId = generatePaytmOrderId("a".repeat(100));

  assert.ok(orderId.length <= 50);
});

test("generates different IDs for separate calls", async () => {
  const firstId = generatePaytmOrderId("test-reference");

  await new Promise((resolve) => setTimeout(resolve, 5));

  const secondId = generatePaytmOrderId("test-reference");

  assert.notEqual(firstId, secondId);
});

// --------------------------------------------------
// PAYTM STATUS VALIDATION TESTS
// These tests mock Axios and do not call Paytm.
// --------------------------------------------------

const originalPost = axios.post;

// --------------------------------------------------
// 1. MISSING SIGNATURE
// --------------------------------------------------

test("rejects status response when signature is missing", async () => {
  axios.post = async () => ({
    data: {
      body: {
        orderId: "ORDER_123",
        resultInfo: {
          resultStatus: "TXN_SUCCESS"
        }
      }
    }
  });

  try {
    await assert.rejects(
      getPaytmTransactionStatus("ORDER_123"),
      /signature is missing/i
    );
  } finally {
    axios.post = originalPost;
  }
});

// --------------------------------------------------
// 2. INVALID CHECKSUM
// --------------------------------------------------

test("rejects status response with an invalid checksum", async () => {
  axios.post = async () => ({
    data: {
      head: {
        signature: "invalid-test-signature"
      },
      body: {
        orderId: "ORDER_123",
        resultInfo: {
          resultStatus: "TXN_SUCCESS"
        }
      }
    }
  });

  try {
    await assert.rejects(
      getPaytmTransactionStatus("ORDER_123"),
      /checksum/i
    );
  } finally {
    axios.post = originalPost;
  }
});

// --------------------------------------------------
// 3. ORDER ID MISMATCH
// --------------------------------------------------

test("rejects status response when order ID does not match", async () => {
  const responseBody = {
    orderId: "DIFFERENT_ORDER",
    resultInfo: {
      resultStatus: "TXN_SUCCESS",
      resultCode: "01",
      resultMsg: "Success"
    }
  };

  const validSignature = await PaytmChecksum.generateSignature(
    JSON.stringify(responseBody),
    process.env.PAYTM_MERCHANT_KEY
  );

  axios.post = async () => ({
    data: {
      head: {
        signature: validSignature
      },
      body: responseBody
    }
  });

  try {
    await assert.rejects(
      getPaytmTransactionStatus("ORDER_123"),
      /order ID mismatch/i
    );
  } finally {
    axios.post = originalPost;
  }
});

// --------------------------------------------------
// 4. VALID SIGNED RESPONSE
// --------------------------------------------------

test("returns status for a valid signed response", async () => {
  const responseBody = {
    orderId: "ORDER_123",
    resultInfo: {
      resultStatus: "TXN_SUCCESS",
      resultCode: "01",
      resultMsg: "Txn Success"
    },
    txnId: "TEST_TXN_123",
    txnAmount: "100.00",
    bankTxnId: "TEST_BANK_123",
    paymentMode: "UPI"
  };

  const validSignature = await PaytmChecksum.generateSignature(
    JSON.stringify(responseBody),
    process.env.PAYTM_MERCHANT_KEY
  );

  axios.post = async () => ({
    data: {
      head: {
        signature: validSignature
      },
      body: responseBody
    }
  });

  try {
    const result = await getPaytmTransactionStatus("ORDER_123");

    assert.equal(result.success, true);
    assert.equal(result.orderId, "ORDER_123");
    assert.equal(result.status, "TXN_SUCCESS");
    assert.equal(result.resultCode, "01");
    assert.equal(result.txnId, "TEST_TXN_123");
    assert.equal(result.txnAmount, "100.00");
    assert.equal(result.paymentMode, "UPI");
  } finally {
    axios.post = originalPost;
  }
});


const axios = require("axios");
const PaytmChecksum = require("paytmchecksum");

// ======================================================
// PAYTM CONFIG
// ======================================================

const PAYTM_MID = process.env.PAYTM_MID;
const PAYTM_MERCHANT_KEY = process.env.PAYTM_MERCHANT_KEY;

const PAYTM_ENVIRONMENT =
  process.env.PAYTM_ENVIRONMENT || "staging";

const PAYTM_PG_DOMAIN =
  process.env.PAYTM_PG_DOMAIN ||
  (PAYTM_ENVIRONMENT === "production"
    ? "https://secure.paytmpayments.com"
    : "https://securestage.paytmpayments.com");

const PAYTM_WEBSITE_NAME =
  process.env.PAYTM_WEBSITE_NAME ||
  (PAYTM_ENVIRONMENT === "production"
    ? "DEFAULT"
    : "WEBSTAGING");

const PAYTM_CALLBACK_URL =
  process.env.PAYTM_CALLBACK_URL;

// ======================================================
// VALIDATE CONFIG
// ======================================================

function validatePaytmConfig() {
  const missing = [];

  if (!PAYTM_MID) {
    missing.push("PAYTM_MID");
  }

  if (!PAYTM_MERCHANT_KEY) {
    missing.push("PAYTM_MERCHANT_KEY");
  }

  if (!PAYTM_CALLBACK_URL) {
    missing.push("PAYTM_CALLBACK_URL");
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing Paytm configuration: ${missing.join(", ")}`
    );
  }
}

// ======================================================
// GENERATE ORDER ID
// ======================================================

function generatePaytmOrderId(reference) {
  const cleanReference = String(reference || "")
    .replace(/[^A-Za-z0-9_@-]/g, "")
    .slice(0, 35);

  const timestamp = Date.now();

  const orderId =
    `GROMAGE_${cleanReference}_${timestamp}`;

  // Paytm orderId max length is 50 characters.
  return orderId.slice(0, 50);
}

// ======================================================
// FORMAT AMOUNT
// ======================================================

function formatAmount(amount) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    throw new Error("Invalid payment amount");
  }

  if (numericAmount <= 0) {
    throw new Error(
      "Payment amount must be greater than zero"
    );
  }

  return numericAmount.toFixed(2);
}

// ======================================================
// INITIATE PAYTM TRANSACTION
// ======================================================

async function createPaytmTransaction({
  reference,
  amount,
  userId,
  customerId,
  mobile,
  email
}) {
  validatePaytmConfig();

  if (!reference) {
    throw new Error("Payment reference is required");
  }

  const formattedAmount = formatAmount(amount);
  const orderId = generatePaytmOrderId(reference);

  // ----------------------------------------------------
  // PAYTM REQUEST BODY
  // ----------------------------------------------------

  const body = {
    requestType: "Payment",
    mid: PAYTM_MID,
    websiteName: PAYTM_WEBSITE_NAME,
    orderId,
    callbackUrl: PAYTM_CALLBACK_URL,

    txnAmount: {
      value: formattedAmount,
      currency: "INR"
    },

    userInfo: {
      custId: String(
        customerId || userId || reference
      )
    }
  };

  // Add customer information only when available.
  if (mobile) {
    body.userInfo.mobile = String(mobile);
  }

  if (email) {
    body.userInfo.email = String(email);
  }

  // ----------------------------------------------------
  // CHECKSUM
  // ----------------------------------------------------

  const bodyString = JSON.stringify(body);

  const signature =
    await PaytmChecksum.generateSignature(
      bodyString,
      PAYTM_MERCHANT_KEY
    );

  const requestPayload = {
    head: {
      signature
    },
    body
  };

  // ----------------------------------------------------
  // PAYTM INITIATE TRANSACTION API
  // ----------------------------------------------------

  const url =
    `${PAYTM_PG_DOMAIN}/theia/api/v1/initiateTransaction` +
    `?mid=${encodeURIComponent(PAYTM_MID)}` +
    `&orderId=${encodeURIComponent(orderId)}`;

  try {
    const response = await axios.post(
      url,
      requestPayload,
      {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 15000
      }
    );

    const responseData = response.data;

    // --------------------------------------------------
    // CHECK RESPONSE STRUCTURE
    // --------------------------------------------------

    if (
      !responseData ||
      typeof responseData !== "object" ||
      !responseData.body ||
      typeof responseData.body !== "object"
    ) {
      throw new Error(
        "Invalid response received from Paytm"
      );
    }

    // --------------------------------------------------
    // VERIFY RESPONSE CHECKSUM WHEN PRESENT
    // --------------------------------------------------

    if (responseData.head?.signature) {
      const responseBodyString =
        JSON.stringify(responseData.body);

      const isValid =
        await PaytmChecksum.verifySignature(
          responseBodyString,
          PAYTM_MERCHANT_KEY,
          responseData.head.signature
        );

      if (!isValid) {
        throw new Error(
          "Invalid Paytm response checksum"
        );
      }
    }

    // --------------------------------------------------
    // CHECK TRANSACTION INITIATION RESULT
    // --------------------------------------------------

    if (
      responseData.body.resultInfo?.resultStatus === "F"
    ) {
      throw new Error(
        responseData.body.resultInfo.resultMsg ||
        "Paytm transaction initiation failed"
      );
    }

    const txnToken = responseData.body.txnToken;

    if (!txnToken) {
      throw new Error(
        "Paytm txnToken was not returned"
      );
    }

    // --------------------------------------------------
    // SUCCESS
    // --------------------------------------------------

    return {
      success: true,
      orderId,
      reference,
      amount: formattedAmount,
      currency: "INR",
      mid: PAYTM_MID,
      txnToken,
      environment: PAYTM_ENVIRONMENT,
      response: responseData
    };

  } catch (error) {
    if (error.response) {
      console.error(
        "PAYTM INITIATE API ERROR:",
        {
          status: error.response.status,
          data: error.response.data
        }
      );

      throw new Error(
        error.response.data?.body?.resultInfo?.resultMsg ||
        "Paytm transaction initiation failed"
      );
    }

    console.error(
      "PAYTM INITIATE ERROR:",
      error.message
    );

    throw error;
  }
}

// ======================================================
// CHECK PAYTM TRANSACTION STATUS
// ======================================================

async function getPaytmTransactionStatus(orderId) {
  validatePaytmConfig();

  if (!orderId) {
    throw new Error(
      "Paytm orderId is required"
    );
  }

  const body = {
    mid: PAYTM_MID,
    orderId
  };

  const bodyString = JSON.stringify(body);

  const signature =
    await PaytmChecksum.generateSignature(
      bodyString,
      PAYTM_MERCHANT_KEY
    );

  const requestPayload = {
    head: {
      signature
    },
    body
  };

  const url =
    `${PAYTM_PG_DOMAIN}/v3/order/status`;

  try {
    const response = await axios.post(
      url,
      requestPayload,
      {
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 15000
      }
    );

    const responseData = response.data;

    // --------------------------------------------------
    // VALIDATE RESPONSE STRUCTURE
    // --------------------------------------------------

    if (
      !responseData ||
      typeof responseData !== "object" ||
      !responseData.body ||
      typeof responseData.body !== "object"
    ) {
      throw new Error(
        "Invalid Paytm status response"
      );
    }

    // --------------------------------------------------
    // VERIFY RESPONSE CHECKSUM
    // --------------------------------------------------

    const responseSignature =
      responseData.head?.signature;

    if (
      typeof responseSignature !== "string" ||
      !responseSignature.trim()
    ) {
      throw new Error(
        "Paytm status response signature is missing"
      );
    }

    const responseBodyString =
      JSON.stringify(responseData.body);

    const isValid =
      await PaytmChecksum.verifySignature(
        responseBodyString,
        PAYTM_MERCHANT_KEY,
        responseSignature
      );

    if (!isValid) {
      throw new Error(
        "Invalid Paytm status response checksum"
      );
    }

    // --------------------------------------------------
    // VALIDATE ORDER ID WHEN RETURNED
    // --------------------------------------------------

    const responseOrderId =
      responseData.body.orderId;

    if (
      responseOrderId &&
      String(responseOrderId) !== String(orderId)
    ) {
      throw new Error(
        "Paytm status response order ID mismatch"
      );
    }

    // --------------------------------------------------
    // RETURN VERIFIED STATUS
    // --------------------------------------------------

    return {
      success: true,
      orderId,

      status:
        responseData.body.resultInfo?.resultStatus ||
        null,

      resultCode:
        responseData.body.resultInfo?.resultCode ||
        null,

      resultMessage:
        responseData.body.resultInfo?.resultMsg ||
        null,

      txnId:
        responseData.body.txnId ||
        null,

      txnAmount:
        responseData.body.txnAmount ||
        null,

      bankTxnId:
        responseData.body.bankTxnId ||
        null,

      paymentMode:
        responseData.body.paymentMode ||
        null,

      response: responseData
    };

  } catch (error) {
    if (error.response) {
      console.error(
        "PAYTM STATUS API ERROR:",
        {
          status: error.response.status,
          data: error.response.data
        }
      );

      throw new Error(
        error.response.data?.body?.resultInfo?.resultMsg ||
        "Paytm transaction status check failed"
      );
    }

    console.error(
      "PAYTM STATUS ERROR:",
      error.message
    );

    throw error;
  }
}

// ======================================================
// EXPORT
// ======================================================

module.exports = {
  createPaytmTransaction,
  getPaytmTransactionStatus,
  generatePaytmOrderId,
  formatAmount
};

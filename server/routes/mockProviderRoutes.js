// ======================================================
// MOCK PROVIDER ROUTES
// ======================================================

const express = require("express");

const router = express.Router();

const MockProviderOrder = require("../models/MockProviderOrder");

console.log("MOCK PROVIDER ROUTES LOADED");

// ======================================================
// MOCK RETRY TEST CONTROL
// ======================================================

let mockAddAttemptCount = 0;

// ======================================================
// MOCK STATUS TEST CONTROL
// ======================================================

const getStatusMode = () => {
  return String(
    process.env.MOCK_PROVIDER_STATUS_MODE || "normal"
  )
    .trim()
    .toLowerCase();
};

const getStatusDelayMs = () => {
  const value = Number(
    process.env.MOCK_PROVIDER_STATUS_DELAY_MS || 0
  );

  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return value;
};

// ======================================================
// MOCK PROVIDER SERVICES API
// ======================================================

router.post("/services", (req, res) => {
  try {
    console.log("====================================");
    console.log("MOCK PROVIDER SERVICES API CALLED");
    console.log("REQUEST BODY:", req.body);
    console.log("====================================");

    const { key, action } = req.body || {};

    // --------------------------------------------------
    // CHECK API KEY
    // --------------------------------------------------

    if (
      !key ||
      typeof key !== "string" ||
      !key.trim()
    ) {
      return res.status(401).json({
        error: "API key is required"
      });
    }

    // --------------------------------------------------
    // CHECK ACTION
    // --------------------------------------------------

    if (action !== "services") {
      return res.status(400).json({
        error: "Invalid action"
      });
    }

    // --------------------------------------------------
    // MOCK SERVICES
    // --------------------------------------------------

    const services = [
      {
        service: "1001",
        name: "Instagram Followers",
        type: "Default",
        category: "Instagram",
        rate: "0.50",
        min: "100",
        max: "10000",
        refill: true,
        cancel: true
      },
      {
        service: "1002",
        name: "Instagram Likes",
        type: "Default",
        category: "Instagram",
        rate: "0.25",
        min: "50",
        max: "5000",
        refill: false,
        cancel: true
      },
      {
        service: "1003",
        name: "YouTube Views",
        type: "Default",
        category: "YouTube",
        rate: "1.20",
        min: "100",
        max: "50000",
        refill: false,
        cancel: false
      }
    ];

    return res.status(200).json(services);

  } catch (error) {
    console.error(
      "MOCK PROVIDER SERVICES ERROR:",
      error
    );

    return res.status(500).json({
      error: "Mock provider server error"
    });
  }
});

// ======================================================
// MOCK PROVIDER CREATE ORDER API
// ======================================================

router.post("/order", async (req, res) => {
  try {
    console.log("====================================");
    console.log("MOCK PROVIDER ORDER API CALLED");
    console.log("REQUEST BODY:", req.body);
    console.log("====================================");

    const {
      key,
      action,
      service,
      link,
      quantity
    } = req.body || {};

    // --------------------------------------------------
    // CHECK API KEY
    // --------------------------------------------------

    if (
      !key ||
      typeof key !== "string" ||
      !key.trim()
    ) {
      return res.status(401).json({
        error: "API key is required"
      });
    }

    // --------------------------------------------------
    // CHECK ACTION
    // --------------------------------------------------

    if (action !== "add") {
      return res.status(400).json({
        error: "Invalid action"
      });
    }

    // --------------------------------------------------
    // RETRY TEST MODE
    // --------------------------------------------------

    const configuredFailures = Number(
      process.env.MOCK_PROVIDER_FAIL_ADD_ATTEMPTS || 0
    );

    if (
      Number.isInteger(configuredFailures) &&
      configuredFailures > 0 &&
      mockAddAttemptCount < configuredFailures
    ) {
      mockAddAttemptCount++;

      console.log("====================================");
      console.log(
        "MOCK PROVIDER TRANSIENT FAILURE"
      );
      console.log(
        "ATTEMPT:",
        mockAddAttemptCount
      );
      console.log(
        "CONFIGURED FAILURES:",
        configuredFailures
      );
      console.log(
        "RETURNING HTTP 503 FOR RETRY TEST"
      );
      console.log("====================================");

      return res.status(503).json({
        error:
          "Temporary provider failure for retry test",
        retryable: true,
        attempt: mockAddAttemptCount
      });
    }

    // --------------------------------------------------
    // CHECK SERVICE
    // --------------------------------------------------

    if (
      !service ||
      !String(service).trim()
    ) {
      return res.status(400).json({
        error: "Service is required"
      });
    }

    // --------------------------------------------------
    // CHECK LINK
    // --------------------------------------------------

    if (
      !link ||
      typeof link !== "string" ||
      !link.trim()
    ) {
      return res.status(400).json({
        error: "Link is required"
      });
    }

    // --------------------------------------------------
    // CHECK QUANTITY
    // --------------------------------------------------

    const numericQuantity = Number(quantity);

    if (
      !Number.isInteger(numericQuantity) ||
      numericQuantity <= 0
    ) {
      return res.status(400).json({
        error:
          "Quantity must be a valid positive integer"
      });
    }

    // --------------------------------------------------
    // CHECK SUPPORTED SERVICE
    // --------------------------------------------------

    const supportedServices = [
      "1001",
      "1002",
      "1003"
    ];

    if (
      !supportedServices.includes(
        String(service)
      )
    ) {
      return res.status(400).json({
        error: "Provider service not found"
      });
    }

    // --------------------------------------------------
    // GENERATE PROVIDER ORDER ID
    // --------------------------------------------------

    const providerOrderId =
      `MOCK-${Date.now()}-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

    // --------------------------------------------------
    // DETERMINE REFILL SUPPORT
    // --------------------------------------------------

    const refillSupported =
      String(service) === "1001";

    // --------------------------------------------------
    // CREATE MOCK ORDER IN MONGODB
    // --------------------------------------------------

    const mockOrder =
      await MockProviderOrder.create({
        providerOrderId,

        service: String(service),

        link: link.trim(),

        quantity: numericQuantity,

        status: "processing",

        startCount: 0,

        remains: numericQuantity,

        refill: refillSupported,

        refillId: null
      });

    // --------------------------------------------------
    // PROVIDER RESPONSE
    // --------------------------------------------------

    const providerResponse = {
      order: providerOrderId
    };

    console.log(
      "MOCK PROVIDER ORDER CREATED:",
      providerResponse
    );

    console.log(
      "MOCK ORDER STORED IN MONGODB:",
      mockOrder
    );

    // --------------------------------------------------
    // SUCCESS
    // --------------------------------------------------

    return res.status(200).json({
      order: providerOrderId
    });

  } catch (error) {
    console.error(
      "MOCK PROVIDER ORDER ERROR:",
      error
    );

    return res.status(500).json({
      error: "Mock provider server error"
    });
  }
});

// ======================================================
// MOCK PROVIDER ORDER STATUS API
// ======================================================

router.post(
  "/order/status",
  async (req, res) => {
    try {
      console.log("====================================");
      console.log(
        "MOCK PROVIDER ORDER STATUS API CALLED"
      );
      console.log(
        "REQUEST BODY:",
        req.body
      );
      console.log("====================================");

      const {
        key,
        action,
        order
      } = req.body || {};

      // ------------------------------------------------
      // CHECK API KEY
      // ------------------------------------------------

      if (
        !key ||
        typeof key !== "string" ||
        !key.trim()
      ) {
        return res.status(401).json({
          error: "API key is required"
        });
      }

      // ------------------------------------------------
      // CHECK ACTION
      // ------------------------------------------------

      if (action !== "status") {
        return res.status(400).json({
          error: "Invalid action"
        });
      }

      // ------------------------------------------------
      // CHECK ORDER ID
      // ------------------------------------------------

      if (
        !order ||
        !String(order).trim()
      ) {
        return res.status(400).json({
          error: "Order ID is required"
        });
      }

      const providerOrderId =
        String(order).trim();

      // ------------------------------------------------
      // FIND ORDER IN MONGODB
      // ------------------------------------------------

      const mockOrder =
        await MockProviderOrder.findOne({
          providerOrderId
        }).lean();

      if (!mockOrder) {
        console.log(
          "MOCK PROVIDER ORDER NOT FOUND:",
          providerOrderId
        );

        return res.status(404).json({
          error: "Order not found"
        });
      }

      // ------------------------------------------------
      // STATUS TEST MODE
      // ------------------------------------------------

      const statusMode =
        getStatusMode();

      const statusDelayMs =
        getStatusDelayMs();

      console.log(
        "MOCK STATUS MODE:",
        statusMode
      );

      console.log(
        "MOCK STATUS DELAY:",
        `${statusDelayMs}ms`
      );

      // ------------------------------------------------
      // DELAY / TIMEOUT TEST
      // ------------------------------------------------

      if (statusDelayMs > 0) {
        console.log("====================================");
        console.log(
          "MOCK PROVIDER STATUS DELAY STARTED"
        );
        console.log(
          "DELAY:",
          `${statusDelayMs}ms`
        );
        console.log("====================================");

        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              statusDelayMs
            )
        );

        console.log(
          "MOCK PROVIDER STATUS DELAY FINISHED"
        );
      }

      // ------------------------------------------------
      // RATE LIMIT TEST
      // ------------------------------------------------

      if (statusMode === "rate_limit") {
        console.log(
          "MOCK PROVIDER RETURNING HTTP 429"
        );

        return res.status(429).json({
          error:
            "Too many requests - rate limit exceeded",
          retryable: true
        });
      }

      // ------------------------------------------------
      // INSUFFICIENT BALANCE TEST
      // ------------------------------------------------

      if (
        statusMode ===
        "insufficient_balance"
      ) {
        console.log(
          "MOCK PROVIDER RETURNING HTTP 402"
        );

        return res.status(402).json({
          error:
            "Insufficient provider balance",
          retryable: false
        });
      }

      // ------------------------------------------------
      // INVALID RESPONSE TEST
      // ------------------------------------------------

      if (
        statusMode ===
        "invalid_response"
      ) {
        console.log(
          "MOCK PROVIDER RETURNING INVALID RESPONSE"
        );

        return res.status(200).json({
          order: providerOrderId
        });
      }

      // ------------------------------------------------
      // NORMAL STATUS RESPONSE
      // ------------------------------------------------

      return res.status(200).json({
        order:
          mockOrder.providerOrderId,

        status:
          mockOrder.status,

        start_count:
          mockOrder.startCount,

        remains:
          mockOrder.remains
      });

    } catch (error) {
      console.error(
        "MOCK PROVIDER ORDER STATUS ERROR:",
        error
      );

      return res.status(500).json({
        error:
          "Mock provider server error"
      });
    }
  }
);

// ======================================================
// MOCK PROVIDER ORDER CANCEL API
// ======================================================

router.post(
  "/order/cancel",
  async (req, res) => {
    try {
      console.log("====================================");
      console.log(
        "MOCK PROVIDER ORDER CANCEL API CALLED"
      );
      console.log(
        "REQUEST BODY:",
        req.body
      );
      console.log("====================================");

      const {
        key,
        action,
        order
      } = req.body || {};

      // ------------------------------------------------
      // CHECK API KEY
      // ------------------------------------------------

      if (
        !key ||
        typeof key !== "string" ||
        !key.trim()
      ) {
        return res.status(401).json({
          error: "API key is required"
        });
      }

      // ------------------------------------------------
      // CHECK ACTION
      // ------------------------------------------------

      if (action !== "cancel") {
        return res.status(400).json({
          error: "Invalid action"
        });
      }

      // ------------------------------------------------
      // CHECK ORDER ID
      // ------------------------------------------------

      if (
        !order ||
        !String(order).trim()
      ) {
        return res.status(400).json({
          error: "Order ID is required"
        });
      }

      const providerOrderId =
        String(order).trim();

      // ------------------------------------------------
      // FIND ORDER
      // ------------------------------------------------

      const mockOrder =
        await MockProviderOrder.findOne({
          providerOrderId
        });

      if (!mockOrder) {
        return res.status(404).json({
          error: "Order not found"
        });
      }

      // ------------------------------------------------
      // CHECK COMPLETED
      // ------------------------------------------------

      if (
        mockOrder.status ===
        "completed"
      ) {
        return res.status(400).json({
          error:
            "Order cannot be canceled because it is already completed"
        });
      }

      // ------------------------------------------------
      // CHECK ALREADY CANCELED
      // ------------------------------------------------

      if (
        mockOrder.status ===
        "canceled"
      ) {
        return res.status(400).json({
          error:
            "Order is already canceled"
        });
      }

      // ------------------------------------------------
      // UPDATE STATUS
      // ------------------------------------------------

      mockOrder.status =
        "canceled";

      await mockOrder.save();

      console.log(
        "MOCK PROVIDER ORDER CANCELED:",
        mockOrder
      );

      // ------------------------------------------------
      // SUCCESS
      // ------------------------------------------------

      return res.status(200).json({
        order: providerOrderId,
        status: "canceled"
      });

    } catch (error) {
      console.error(
        "MOCK PROVIDER ORDER CANCEL ERROR:",
        error
      );

      return res.status(500).json({
        error:
          "Mock provider server error"
      });
    }
  }
);

// ======================================================
// MOCK PROVIDER ORDER REFILL API
// ======================================================

router.post(
  "/order/refill",
  async (req, res) => {
    try {
      console.log("====================================");
      console.log(
        "MOCK PROVIDER ORDER REFILL API CALLED"
      );
      console.log(
        "REQUEST BODY:",
        req.body
      );
      console.log("====================================");

      const {
        key,
        action,
        order
      } = req.body || {};

      // ------------------------------------------------
      // CHECK API KEY
      // ------------------------------------------------

      if (
        !key ||
        typeof key !== "string" ||
        !key.trim()
      ) {
        return res.status(401).json({
          error: "API key is required"
        });
      }

      // ------------------------------------------------
      // CHECK ACTION
      // ------------------------------------------------

      if (action !== "refill") {
        return res.status(400).json({
          error: "Invalid action"
        });
      }

      // ------------------------------------------------
      // CHECK ORDER ID
      // ------------------------------------------------

      if (
        !order ||
        !String(order).trim()
      ) {
        return res.status(400).json({
          error: "Order ID is required"
        });
      }

      const providerOrderId =
        String(order).trim();

      // ------------------------------------------------
      // FIND ORDER
      // ------------------------------------------------

      const mockOrder =
        await MockProviderOrder.findOne({
          providerOrderId
        });

      if (!mockOrder) {
        return res.status(404).json({
          error: "Order not found"
        });
      }

      // ------------------------------------------------
      // CHECK REFILL SUPPORT
      // ------------------------------------------------

      if (!mockOrder.refill) {
        return res.status(400).json({
          error:
            "Refill is not supported for this order"
        });
      }

      // ------------------------------------------------
      // CHECK CANCELED
      // ------------------------------------------------

      if (
        mockOrder.status ===
        "canceled"
      ) {
        return res.status(400).json({
          error:
            "Canceled order cannot be refilled"
        });
      }

      // ------------------------------------------------
      // CHECK FAILED
      // ------------------------------------------------

      if (
        mockOrder.status ===
        "failed"
      ) {
        return res.status(400).json({
          error:
            "Failed order cannot be refilled"
        });
      }

      // ------------------------------------------------
      // CHECK EXISTING REFILL
      // ------------------------------------------------

      if (mockOrder.refillId) {
        return res.status(400).json({
          error:
            "Order has already been refilled",
          refill:
            mockOrder.refillId
        });
      }

      // ------------------------------------------------
      // GENERATE REFILL ID
      // ------------------------------------------------

      const refillId =
        `REFILL-${Date.now()}-${Math.floor(
          1000 + Math.random() * 9000
        )}`;

      // ------------------------------------------------
      // UPDATE ORDER
      // ------------------------------------------------

      mockOrder.refillId =
        refillId;

      mockOrder.status =
        "processing";

      await mockOrder.save();

      // ------------------------------------------------
      // PROVIDER RESPONSE
      // ------------------------------------------------

      const providerResponse = {
        refill: refillId
      };

      console.log(
        "MOCK PROVIDER REFILL CREATED:",
        providerResponse
      );

      console.log(
        "MOCK ORDER AFTER REFILL:",
        mockOrder
      );

      // ------------------------------------------------
      // SUCCESS
      // ------------------------------------------------

      return res.status(200).json(
        providerResponse
      );

    } catch (error) {
      console.error(
        "MOCK PROVIDER ORDER REFILL ERROR:",
        error
      );

      return res.status(500).json({
        error:
          "Mock provider server error"
      });
    }
  }
);

// ======================================================
// EXPORT
// ======================================================

module.exports = router;
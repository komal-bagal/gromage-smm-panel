
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

        // UPDATED:
        // YouTube Views now supports refill
        refill: true,

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
// MOCK PROVIDER BALANCE API
// ======================================================

router.post("/balance", (req, res) => {
  try {
    console.log("====================================");
    console.log("MOCK PROVIDER BALANCE API CALLED");
    console.log("REQUEST BODY:", req.body);
    console.log("====================================");

    const {
      key,
      action
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

    if (action !== "balance") {
      return res.status(400).json({
        error: "Invalid action"
      });
    }

    // --------------------------------------------------
    // MOCK BALANCE
    // --------------------------------------------------

    const balance = {
      balance: "100.00",
      currency: "USD"
    };

    console.log(
      "MOCK PROVIDER BALANCE RESPONSE:",
      balance
    );

    // --------------------------------------------------
    // SUCCESS
    // --------------------------------------------------

    return res.status(200).json(balance);

  } catch (error) {
    console.error(
      "MOCK PROVIDER BALANCE ERROR:",
      error
    );

    return res.status(500).json({
      error: "Mock provider server error"
    });
  }
});

// ======================================================
// MOCK PROVIDER CREATE ORDER API
// IMPORTANT:
// Provider integration calls /order/add
// ======================================================

router.post("/order/add", async (req, res) => {
  try {
    console.log("====================================");
    console.log("MOCK PROVIDER ORDER ADD API CALLED");
    console.log("REQUEST BODY:", req.body);
    console.log("====================================");

    const {
      key,
      action,
      service,
      link,
      quantity,
      runs,
      interval
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
    // ADD ORDER TEST MODE
    // Used for non-retryable provider failure/refund test
    // --------------------------------------------------

    const addMode = String(
      process.env.MOCK_PROVIDER_ADD_MODE || "normal"
    )
      .trim()
      .toLowerCase();

    if (addMode === "insufficient_balance") {
      console.log("====================================");
      console.log(
        "MOCK PROVIDER NON-RETRYABLE FAILURE"
      );
      console.log(
        "MODE: insufficient_balance"
      );
      console.log(
        "RETURNING HTTP 402 FOR REFUND TEST"
      );
      console.log("====================================");

      return res.status(402).json({
        error:
          "Insufficient provider balance for refund test",
        retryable: false
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
    // VALIDATE OPTIONAL DRIP FEED VALUES
    // --------------------------------------------------

    let numericRuns = null;
    let numericInterval = null;

    if (
      runs !== undefined &&
      runs !== null &&
      String(runs).trim() !== ""
    ) {
      numericRuns = Number(runs);

      if (
        !Number.isInteger(numericRuns) ||
        numericRuns <= 0
      ) {
        return res.status(400).json({
          error:
            "Runs must be a valid positive integer"
        });
      }
    }

    if (
      interval !== undefined &&
      interval !== null &&
      String(interval).trim() !== ""
    ) {
      numericInterval = Number(interval);

      if (
        !Number.isInteger(numericInterval) ||
        numericInterval < 0
      ) {
        return res.status(400).json({
          error:
            "Interval must be a valid non-negative integer"
        });
      }
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
    // UPDATED:
    // 1001 and 1003 support refill
    // --------------------------------------------------

    const refillSupported =
      ["1001", "1003"].includes(
        String(service)
      );

    console.log(
      "MOCK SERVICE REFILL SUPPORT:",
      {
        service: String(service),
        refillSupported
      }
    );

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
    // DRIP FEED LOG
    // --------------------------------------------------

    if (
      numericRuns !== null ||
      numericInterval !== null
    ) {
      console.log(
        "MOCK DRIP FEED VALUES:",
        {
          runs: numericRuns,
          interval: numericInterval
        }
      );
    }

    // --------------------------------------------------
    // SUCCESS
    // --------------------------------------------------

    return res.status(200).json({
      order: providerOrderId
    });

  } catch (error) {
    console.error(
      "MOCK PROVIDER ORDER ADD ERROR:",
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
// MOCK PROVIDER TEST STATUS UPDATE API
// Used only for local testing of provider status sync
// ======================================================

router.post(
  "/test/order/status",
  async (req, res) => {
    try {
      console.log("====================================");
      console.log(
        "MOCK PROVIDER TEST STATUS UPDATE API CALLED"
      );
      console.log(
        "REQUEST BODY:",
        req.body
      );
      console.log("====================================");

      const {
        providerOrderId,
        status,
        startCount,
        remains
      } = req.body || {};

      // ------------------------------------------------
      // CHECK PROVIDER ORDER ID
      // ------------------------------------------------

      if (
        !providerOrderId ||
        !String(providerOrderId).trim()
      ) {
        return res.status(400).json({
          success: false,
          error: "Provider order ID is required"
        });
      }

      // ------------------------------------------------
      // ALLOWED STATUSES
      // ------------------------------------------------

      const allowedStatuses = [
        "pending",
        "processing",
        "in_progress",
        "completed",
        "partial",
        "canceled",
        "failed"
      ];

      if (
        !status ||
        !allowedStatuses.includes(
          String(status).trim()
        )
      ) {
        return res.status(400).json({
          success: false,
          error: "Invalid provider order status"
        });
      }

      // ------------------------------------------------
      // FIND MOCK ORDER
      // ------------------------------------------------

      const mockOrder =
        await MockProviderOrder.findOne({
          providerOrderId:
            String(providerOrderId).trim()
        });

      if (!mockOrder) {
        return res.status(404).json({
          success: false,
          error: "Mock provider order not found"
        });
      }

      // ------------------------------------------------
      // UPDATE STATUS
      // ------------------------------------------------

      mockOrder.status =
        String(status).trim();

      // ------------------------------------------------
      // UPDATE START COUNT
      // ------------------------------------------------

      if (
        startCount !== undefined &&
        startCount !== null
      ) {
        const numericStartCount =
          Number(startCount);

        if (
          !Number.isFinite(numericStartCount) ||
          numericStartCount < 0
        ) {
          return res.status(400).json({
            success: false,
            error:
              "startCount must be a valid non-negative number"
          });
        }

        mockOrder.startCount =
          numericStartCount;
      }

      // ------------------------------------------------
      // UPDATE REMAINS
      // ------------------------------------------------

      if (
        remains !== undefined &&
        remains !== null
      ) {
        const numericRemains =
          Number(remains);

        if (
          !Number.isFinite(numericRemains) ||
          numericRemains < 0
        ) {
          return res.status(400).json({
            success: false,
            error:
              "remains must be a valid non-negative number"
          });
        }

        mockOrder.remains =
          numericRemains;
      }

      // ------------------------------------------------
      // SAVE
      // ------------------------------------------------

      await mockOrder.save();

      console.log(
        "MOCK PROVIDER TEST ORDER UPDATED:",
        mockOrder
      );

      // ------------------------------------------------
      // RESPONSE
      // ------------------------------------------------

      return res.status(200).json({
        success: true,
        message:
          "Mock provider order status updated",

        order: {
          providerOrderId:
            mockOrder.providerOrderId,

          status:
            mockOrder.status,

          startCount:
            mockOrder.startCount,

          remains:
            mockOrder.remains
        }
      });

    } catch (error) {
      console.error(
        "MOCK PROVIDER TEST STATUS UPDATE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
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

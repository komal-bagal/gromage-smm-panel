process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const { UnrecoverableError } = require("bullmq");

// ------------------------------------------------------
// Stub createProviderOrder BEFORE loading the worker.
// The worker destructures it at load time, so the
// replacement must be in place first.
// ------------------------------------------------------

const providerApiService = require("./services/providerApiService");

let createProviderOrderImpl = async () => {
  throw new Error("createProviderOrder stub not configured");
};

providerApiService.createProviderOrder = (...args) =>
  createProviderOrderImpl(...args);

const Order = require("./models/Order");
const DripFeedRun = require("./models/DripFeedRun");
const Service = require("./models/Service");
const Provider = require("./models/Provider");

const {
  processDripFeedRun,
  saveWithRetry
} = require("./workers/dripFeedWorker");

// ------------------------------------------------------
// Keep originals so we can restore them afterwards
// ------------------------------------------------------

const originals = {
  orderFindById: Order.findById,
  orderUpdateOne: Order.updateOne,
  runFindById: DripFeedRun.findById,
  serviceFindById: Service.findById,
  providerFind: Provider.find,
  providerFindById: Provider.findById,
  consoleLog: console.log,
  consoleError: console.error
};

// ------------------------------------------------------
// Test state + factories
// ------------------------------------------------------

let state;
let providerCalls;
let orderUpdateCalls;

function makeRun(overrides = {}) {
  const run = {
    _id: "run-1",
    runNumber: 1,
    quantity: 100,
    status: "pending",
    providerOrderId: null,
    providerResponse: null,
    error: null,
    failSaveAfterAccept: false,
    saveCalls: 0,
    async save() {
      this.saveCalls++;

      if (this.failSaveAfterAccept && this.providerOrderId) {
        throw new Error("Simulated DB failure");
      }
    },
    ...overrides
  };

  return run;
}

function makeOrder(overrides = {}) {
  return {
    _id: "order-1",
    userId: "user-1",
    serviceId: "service-1",
    link: "https://example.com/post",
    providerId: null,
    status: "pending",
    failSave: false,
    async save() {
      if (this.failSave) {
        throw new Error("Simulated order save failure");
      }
    },
    ...overrides
  };
}

function makeService(overrides = {}) {
  return {
    _id: "service-1",
    providerServiceId: "PS-100",
    ...overrides
  };
}

function makeProvider(id, name, overrides = {}) {
  return {
    _id: id,
    name,
    status: "active",
    ...overrides
  };
}

function makeJob(overrides = {}) {
  return {
    id: "job-1",
    data: {
      orderId: "order-1",
      runId: "run-1",
      userId: "user-1",
      runNumber: 1,
      quantity: 100,
      ...overrides
    }
  };
}

function uncertainError(message = "Timeout") {
  const error = new Error(message);
  error.outcomeUncertain = true;
  return error;
}

// ------------------------------------------------------
// Install stubs
// ------------------------------------------------------

function installStubs() {
  providerCalls = [];
  orderUpdateCalls = [];

  state = {
    run: makeRun(),
    order: makeOrder(),
    service: makeService(),
    providers: [makeProvider("prov-1", "Provider One")],
    assignedProvider: null
  };

  createProviderOrderImpl = async ({ provider }) => {
    providerCalls.push(provider.name);

    return {
      providerOrderId: `PO-${provider.name}`,
      providerResponse: { ok: true }
    };
  };

  DripFeedRun.findById = async () => state.run;
  Order.findById = async () => state.order;
  Service.findById = async () => state.service;

  Order.updateOne = async (...args) => {
    orderUpdateCalls.push(args);
    return { acknowledged: true };
  };

  // Provider.find({...}).select(...).sort(...)
  Provider.find = () => ({
    select: () => ({
      sort: async () => state.providers
    })
  });

  // Provider.findById(id).select(...)
  Provider.findById = () => ({
    select: async () => state.assignedProvider
  });
}

function restoreStubs() {
  Order.findById = originals.orderFindById;
  Order.updateOne = originals.orderUpdateOne;
  DripFeedRun.findById = originals.runFindById;
  Service.findById = originals.serviceFindById;
  Provider.find = originals.providerFind;
  Provider.findById = originals.providerFindById;
  console.log = originals.consoleLog;
  console.error = originals.consoleError;
}

test.beforeEach(() => {
  installStubs();

  // Silence worker logging during tests
  console.log = () => {};
  console.error = () => {};
});

test.afterEach(() => {
  console.log = originals.consoleLog;
  console.error = originals.consoleError;
});

test.after(() => {
  restoreStubs();
});

// ======================================================
// SKIP CASES
// ======================================================

test("skips when the run is not found", async () => {
  state.run = null;

  const result = await processDripFeedRun(makeJob());

  assert.equal(result.success, false);
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "RUN_NOT_FOUND");
  assert.equal(providerCalls.length, 0);
});

test("skips a run that is already completed", async () => {
  state.run = makeRun({ status: "completed" });

  const result = await processDripFeedRun(makeJob());

  assert.equal(result.success, true);
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "RUN_COMPLETED");
  assert.equal(providerCalls.length, 0);
});

test("skips a run that is canceled", async () => {
  state.run = makeRun({ status: "canceled" });

  const result = await processDripFeedRun(makeJob());

  assert.equal(result.success, true);
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "RUN_CANCELED");
  assert.equal(providerCalls.length, 0);
});

test("skips without calling a provider when providerOrderId already exists", async () => {
  state.run = makeRun({ providerOrderId: "EXISTING-1" });

  const result = await processDripFeedRun(makeJob());

  assert.equal(result.success, true);
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "PROVIDER_ORDER_ALREADY_CREATED");
  assert.equal(result.providerOrderId, "EXISTING-1");
  assert.equal(providerCalls.length, 0);
});

test("repairs a pending parent order when providerOrderId already exists", async () => {
  state.run = makeRun({ providerOrderId: "EXISTING-1" });

  await processDripFeedRun(makeJob());

  assert.equal(orderUpdateCalls.length, 1);

  const [filter, update] = orderUpdateCalls[0];

  assert.equal(filter._id, "order-1");
  assert.equal(filter.status, "pending");
  assert.equal(update.$set.status, "processing");
});

test("a failed parent repair does not break the idempotent skip", async () => {
  state.run = makeRun({ providerOrderId: "EXISTING-1" });

  Order.updateOne = async () => {
    throw new Error("Simulated repair failure");
  };

  const result = await processDripFeedRun(makeJob());

  assert.equal(result.skipped, true);
  assert.equal(result.reason, "PROVIDER_ORDER_ALREADY_CREATED");
});

// ======================================================
// VALIDATION FAILURES
// ======================================================

test("fails the run when the parent order is not found", async () => {
  state.order = null;

  await assert.rejects(
    processDripFeedRun(makeJob()),
    /Parent order not found/
  );

  assert.equal(state.run.status, "failed");
  assert.equal(state.run.error, "Parent order not found");
  assert.equal(providerCalls.length, 0);
});

test("fails the run when the order user does not match", async () => {
  state.order = makeOrder({ userId: "someone-else" });

  await assert.rejects(
    processDripFeedRun(makeJob()),
    /Order user mismatch/
  );

  assert.equal(state.run.status, "failed");
  assert.equal(providerCalls.length, 0);
});

test("fails the run when the service is not found", async () => {
  state.service = null;

  await assert.rejects(
    processDripFeedRun(makeJob()),
    /Service not found/
  );

  assert.equal(state.run.status, "failed");
  assert.equal(providerCalls.length, 0);
});

test("fails the run when the quantity is invalid", async () => {
  state.run = makeRun({ quantity: 0 });

  await assert.rejects(
    processDripFeedRun(makeJob({ quantity: 0 })),
    /Invalid run quantity/
  );

  assert.equal(state.run.status, "failed");
  assert.equal(providerCalls.length, 0);
});

test("fails the run when the provider service ID is missing", async () => {
  state.service = makeService({ providerServiceId: undefined });

  await assert.rejects(
    processDripFeedRun(makeJob()),
    /Provider service ID is missing/
  );

  assert.equal(state.run.status, "failed");
  assert.equal(providerCalls.length, 0);
});

test("fails the run when no active provider is available", async () => {
  state.providers = [];

  await assert.rejects(
    processDripFeedRun(makeJob()),
    /No active provider available/
  );

  assert.equal(state.run.status, "failed");
  assert.equal(providerCalls.length, 0);
});

// ======================================================
// SUCCESS PATH
// ======================================================

test("creates a provider order and saves it on the run and parent order", async () => {
  const result = await processDripFeedRun(makeJob());

  assert.equal(result.success, true);
  assert.equal(result.providerOrderId, "PO-Provider One");
  assert.equal(result.providerId, "prov-1");

  assert.deepEqual(providerCalls, ["Provider One"]);

  assert.equal(state.run.providerOrderId, "PO-Provider One");
  assert.equal(state.run.status, "processing");
  assert.equal(state.run.error, null);

  assert.equal(state.order.providerId, "prov-1");
  assert.equal(state.order.status, "processing");
});

test("sends the run quantity and provider service ID to the provider", async () => {
  let received = null;

  createProviderOrderImpl = async (args) => {
    received = args;
    return { providerOrderId: "PO-1" };
  };

  await processDripFeedRun(makeJob({ quantity: 250 }));

  assert.equal(received.service, "PS-100");
  assert.equal(received.quantity, 250);
  assert.equal(received.link, "https://example.com/post");
  assert.equal(received.orderId, "order-1");
});

test("tries the provider assigned to the parent order first", async () => {
  const assigned = makeProvider("prov-9", "Assigned");

  state.order = makeOrder({ providerId: "prov-9" });
  state.assignedProvider = assigned;
  state.providers = [
    makeProvider("prov-1", "Provider One"),
    assigned
  ];

  await processDripFeedRun(makeJob());

  assert.deepEqual(providerCalls, ["Assigned"]);
  assert.equal(state.run.providerOrderId, "PO-Assigned");
});

test("does not overwrite an existing providerId on the parent order", async () => {
  const assigned = makeProvider("prov-9", "Assigned");

  state.order = makeOrder({ providerId: "prov-9" });
  state.assignedProvider = assigned;
  state.providers = [assigned];

  await processDripFeedRun(makeJob());

  assert.equal(state.order.providerId, "prov-9");
});

test("falls back to all active providers when the assigned provider is inactive", async () => {
  state.order = makeOrder({ providerId: "prov-9" });
  state.assignedProvider = makeProvider("prov-9", "Assigned", {
    status: "inactive"
  });

  await processDripFeedRun(makeJob());

  assert.deepEqual(providerCalls, ["Provider One"]);
});

// ======================================================
// FALLBACK BEHAVIOUR
// ======================================================

test("falls back to the next provider after a definite rejection", async () => {
  state.providers = [
    makeProvider("prov-1", "First"),
    makeProvider("prov-2", "Second")
  ];

  createProviderOrderImpl = async ({ provider }) => {
    providerCalls.push(provider.name);

    if (provider.name === "First") {
      throw new Error("Insufficient funds");
    }

    return { providerOrderId: "PO-Second" };
  };

  const result = await processDripFeedRun(makeJob());

  assert.deepEqual(providerCalls, ["First", "Second"]);
  assert.equal(result.providerOrderId, "PO-Second");
  assert.equal(result.providerId, "prov-2");
  assert.equal(state.order.providerId, "prov-2");
});

test("stops fallback and throws UnrecoverableError when the outcome is uncertain", async () => {
  state.providers = [
    makeProvider("prov-1", "First"),
    makeProvider("prov-2", "Second")
  ];

  createProviderOrderImpl = async ({ provider }) => {
    providerCalls.push(provider.name);
    throw uncertainError("Network timeout");
  };

  await assert.rejects(
    processDripFeedRun(makeJob()),
    (error) => {
      assert.ok(error instanceof UnrecoverableError);
      assert.match(error.message, /manual review required/);
      return true;
    }
  );

  // Second provider must NOT be tried
  assert.deepEqual(providerCalls, ["First"]);
  assert.equal(state.run.status, "failed");
  assert.match(state.run.error, /outcome uncertain/);
  assert.equal(state.run.providerOrderId, null);
});

test("treats a response without a provider order ID as uncertain", async () => {
  state.providers = [
    makeProvider("prov-1", "First"),
    makeProvider("prov-2", "Second")
  ];

  createProviderOrderImpl = async ({ provider }) => {
    providerCalls.push(provider.name);
    return { providerResponse: { status: "ok" } };
  };

  await assert.rejects(
    processDripFeedRun(makeJob()),
    (error) => error instanceof UnrecoverableError
  );

  assert.deepEqual(providerCalls, ["First"]);
  assert.equal(state.run.status, "failed");
});

test("still throws UnrecoverableError on uncertain outcome when the run save fails", async () => {
  createProviderOrderImpl = async () => {
    throw uncertainError();
  };

  state.run = makeRun({
    async save() {
      this.saveCalls++;

      // Allow the initial "processing" save, fail afterwards
      if (this.saveCalls > 1) {
        throw new Error("Simulated DB failure");
      }
    }
  });

  await assert.rejects(
    processDripFeedRun(makeJob()),
    (error) => error instanceof UnrecoverableError
  );
});

test("fails the run and rethrows the last error when every provider rejects", async () => {
  state.providers = [
    makeProvider("prov-1", "First"),
    makeProvider("prov-2", "Second")
  ];

  createProviderOrderImpl = async ({ provider }) => {
    providerCalls.push(provider.name);
    throw new Error(`${provider.name} rejected`);
  };

  await assert.rejects(
    processDripFeedRun(makeJob()),
    (error) => {
      assert.ok(!(error instanceof UnrecoverableError));
      assert.equal(error.message, "Second rejected");
      return true;
    }
  );

  assert.deepEqual(providerCalls, ["First", "Second"]);
  assert.equal(state.run.status, "failed");
  assert.equal(state.run.error, "Second rejected");
});

// ======================================================
// SAVE FAILURES AFTER PROVIDER ACCEPTED
// ======================================================

test("throws UnrecoverableError when the run cannot be saved after the provider accepted", async () => {
  state.run = makeRun({ failSaveAfterAccept: true });

  await assert.rejects(
    processDripFeedRun(makeJob()),
    (error) => {
      assert.ok(error instanceof UnrecoverableError);
      assert.match(error.message, /Manual review required/);
      return true;
    }
  );

  // Exactly one provider order was created
  assert.deepEqual(providerCalls, ["Provider One"]);
});

test("does not fail the job when only the parent order save fails", async () => {
  state.order = makeOrder({ failSave: true });

  const result = await processDripFeedRun(makeJob());

  assert.equal(result.success, true);
  assert.equal(result.providerOrderId, "PO-Provider One");
  assert.equal(state.run.providerOrderId, "PO-Provider One");
});

// ======================================================
// saveWithRetry
// ======================================================

test("saveWithRetry returns true when the first save succeeds", async () => {
  let calls = 0;

  const ok = await saveWithRetry(
    {
      async save() {
        calls++;
      }
    },
    "test",
    3,
    1
  );

  assert.equal(ok, true);
  assert.equal(calls, 1);
});

test("saveWithRetry retries and succeeds after a transient failure", async () => {
  let calls = 0;

  const ok = await saveWithRetry(
    {
      async save() {
        calls++;

        if (calls < 3) {
          throw new Error("transient");
        }
      }
    },
    "test",
    3,
    1
  );

  assert.equal(ok, true);
  assert.equal(calls, 3);
});

test("saveWithRetry returns false after all attempts fail", async () => {
  let calls = 0;

  const ok = await saveWithRetry(
    {
      async save() {
        calls++;
        throw new Error("permanent");
      }
    },
    "test",
    3,
    1
  );

  assert.equal(ok, false);
  assert.equal(calls, 3);
});
const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  mapProviderStatus,
  syncOrderProviderStatus
} = require("./services/providerStatusService");

test("Maps standard provider statuses", () => {
  const cases = [
    ["pending", "pending"],
    ["processing", "processing"],
    ["in progress", "in_progress"],
    ["in_progress", "in_progress"],
    ["completed", "completed"],
    ["complete", "completed"],
    ["partial", "partial"],
    ["canceled", "canceled"],
    ["cancelled", "canceled"],
    ["cancel", "canceled"],
    ["refunded", "refunded"],
    ["failed", "failed"]
  ];

  for (const [input, expected] of cases) {
    assert.equal(mapProviderStatus(input), expected);
  }
});

test("Ignores case and surrounding spaces", () => {
  assert.equal(mapProviderStatus(" COMPLETED "), "completed");
  assert.equal(mapProviderStatus(" In Progress "), "in_progress");
});

test("Rejects unknown or empty provider statuses", () => {
  assert.equal(mapProviderStatus("unknown_status"), null);
  assert.equal(mapProviderStatus(""), null);
  assert.equal(mapProviderStatus(null), null);
  assert.equal(mapProviderStatus(undefined), null);
});

test("Rejects a missing order ID", async () => {
  await assert.rejects(
    syncOrderProviderStatus({}),
    /Order ID is required/
  );
});

test("Rejects an invalid order ID", async () => {
  await assert.rejects(
    syncOrderProviderStatus({ orderId: "not-a-valid-id" }),
    /Invalid Order ID/
  );
});
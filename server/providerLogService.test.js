
const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  sanitizePayload,
  normalizeOperation,
  sanitizeEndpoint
} = require("./services/providerLogService");

test("Redacts sensitive fields from nested payloads", () => {
  const result = sanitizePayload({
    action: "add",
    apiKey: "secret-value",
    nested: {
      access_token: "another-secret",
      username: "test-user"
    }
  });

  assert.equal(result.apiKey, "[REDACTED]");
  assert.equal(result.nested.access_token, "[REDACTED]");
  assert.equal(result.nested.username, "test-user");
});

test("Redacts secrets embedded in text", () => {
  const result = sanitizePayload(
    "api_key=abc123 Bearer token123"
  );

  assert.ok(!result.includes("abc123"));
  assert.ok(!result.includes("token123"));
  assert.ok(result.includes("[REDACTED]"));
});

test("Sanitizes arrays and preserves ordinary values", () => {
  const result = sanitizePayload([
    { password: "hidden" },
    { service: "Instagram" }
  ]);

  assert.equal(result[0].password, "[REDACTED]");
  assert.equal(result[1].service, "Instagram");
});

test("Normalizes supported provider operations", () => {
  assert.equal(normalizeOperation("STATUS"), "status");
  assert.equal(normalizeOperation("CANCEL"), "cancel");
  assert.equal(normalizeOperation("create-order"), "create_order");
  assert.equal(normalizeOperation("not-supported"), "unknown");
});

test("Removes URL query parameters and fragments from log endpoints", () => {
  const result = sanitizeEndpoint(
    "https://provider.example/api?key=secret#section"
  );

  assert.ok(!result.includes("secret"));
  assert.ok(!result.includes("?"));
  assert.ok(!result.includes("#"));
});

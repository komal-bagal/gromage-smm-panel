const { Queue } = require("bullmq");

const redisConnection = require("../config/redis");

// ======================================================
// PROVIDER STATUS SYNC QUEUE
// ======================================================

const providerStatusQueue = new Queue("provider-status-sync", {
  connection: redisConnection
});

// ======================================================
// EXPORT
// ======================================================

module.exports = providerStatusQueue;
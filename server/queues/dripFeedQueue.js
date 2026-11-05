const { Queue } = require("bullmq");

const redisConnection = require("../config/redis");

// ======================================================
// DRIP FEED QUEUE
// ======================================================

const dripFeedQueue = new Queue("drip-feed", {
  connection: redisConnection
});

// ======================================================
// EXPORT
// ======================================================

module.exports = dripFeedQueue;
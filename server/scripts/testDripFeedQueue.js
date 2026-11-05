require("dotenv").config();

const dripFeedQueue = require("../queues/dripFeedQueue");

async function addTestJob() {
  try {
    const job = await dripFeedQueue.add("test-drip-feed", {
      orderId: "TEST-ORDER-001",
      runNumber: 1
    });

    console.log("Test job added:", job.id);

    await dripFeedQueue.close();
  } catch (error) {
    console.error("Queue test failed:", error.message);
    await dripFeedQueue.close();
    process.exit(1);
  }
}

addTestJob();
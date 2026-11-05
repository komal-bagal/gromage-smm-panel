const { spawn } = require("node:child_process");

const TEST_FILES = [
  "resellerApi.test.js",
  "providerStatusService.test.js",
  "providerLogService.test.js",
  "providerApiService.test.js",
  "orderRefund.test.js",
  "paytmService.test.js",
  "paymentController.test.js",
  "cashfreeService.test.js",
  "cashfreeWebhook.test.js",
  "providerStatusRecoveryService.test.js",
  "providerStatusRecovery.integration.test.js",
  "providerStatusRecovery.service.integration.test.js",
  "dripFeedWorker.test.js"
];

const HOST = "127.0.0.1";
const PORT = 5001;
const STARTUP_TIMEOUT_MS = 15000;

const env = {
  ...process.env,
  NODE_ENV: "test"
};

let serverProcess;
let testProcess;
let stopping = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (stopping || serverProcess.exitCode !== null) {
      throw new Error("Test server exited before becoming ready.");
    }

    try {
      const response = await fetch(`http://${HOST}:${PORT}`);

      if (response) {
        return;
      }
    } catch {
      // Server is not ready yet. Retry shortly.
    }

    await sleep(250);
  }

  throw new Error(
    "Test server did not become ready within 15 seconds."
  );
}

function stopProcess(child) {
  if (child && child.exitCode === null && !child.killed) {
    child.kill();
  }
}

async function main() {
  let exitCode = 1;

  try {
    serverProcess = spawn(
      process.execPath,
      ["testServer.js"],
      {
        env,
        stdio: "inherit"
      }
    );

    await waitForServer();

    console.log(
      "\nTest server is ready. Running test suite...\n"
    );

    testProcess = spawn(
      process.execPath,
      ["--test", ...TEST_FILES],
      {
        env,
        stdio: "inherit"
      }
    );

    exitCode = await new Promise((resolve, reject) => {
      testProcess.once("error", reject);

      testProcess.once("exit", (code) => {
        resolve(code ?? 1);
      });
    });
  } catch (error) {
    console.error("\nTest runner error:", error.message);
  } finally {
    stopping = true;

    stopProcess(testProcess);
    stopProcess(serverProcess);
  }

  process.exitCode = exitCode;
}

main();
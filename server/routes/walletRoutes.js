const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");

const permissionMiddleware = require(
  "../middleware/permissionMiddleware"
);

const {
  getWallet,
  creditWallet,
  debitWallet,
  getWalletTransactions,
  createRecharge
} = require("../controllers/walletController");

// ======================================================
// GET WALLET
// ======================================================

router.get(
  "/",
  authMiddleware,
  permissionMiddleware("wallet.view"),
  getWallet
);

// ======================================================
// GET WALLET TRANSACTIONS
// ======================================================

router.get(
  "/transactions",
  authMiddleware,
  permissionMiddleware("wallet.transactions"),
  getWalletTransactions
);

// ======================================================
// CREDIT WALLET
// ======================================================

router.post(
  "/credit",
  authMiddleware,
  permissionMiddleware("wallet.credit"),
  creditWallet
);

// ======================================================
// DEBIT WALLET
// ======================================================

router.post(
  "/debit",
  authMiddleware,
  permissionMiddleware("wallet.debit"),
  debitWallet
);

// ======================================================
// CREATE RECHARGE
// ======================================================

router.post(
  "/recharge",
  authMiddleware,
  createRecharge
);

// ======================================================
// EXPORT
// ======================================================

module.exports = router;
const express = require("express");

const brandingController =
  require("../controllers/brandingController");

const authMiddleware =
  require("../middleware/authMiddleware");

console.log("========== BRANDING ROUTES LOADED ==========");
console.log(
  "createBranding:",
  typeof brandingController.createBranding
);
console.log(
  "getBranding:",
  typeof brandingController.getBranding
);
console.log(
  "updateBranding:",
  typeof brandingController.updateBranding
);
console.log(
  "deleteBranding:",
  typeof brandingController.deleteBranding
);
console.log(
  "authMiddleware:",
  typeof authMiddleware
);
console.log("============================================");

const router = express.Router();

router.post(
  "/",
  authMiddleware,
  brandingController.createBranding
);

router.get(
  "/",
  brandingController.getBranding
);

router.put(
  "/",
  authMiddleware,
  brandingController.updateBranding
);

router.delete(
  "/",
  authMiddleware,
  brandingController.deleteBranding
);

module.exports = router;
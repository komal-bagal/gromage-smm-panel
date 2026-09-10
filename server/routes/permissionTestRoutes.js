const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const permissionMiddleware = require("../middleware/permissionMiddleware");

router.get(
  "/test-permission",
  authMiddleware,
  permissionMiddleware("test.permission"),
  (req, res) => {
    res.status(200).json({
      message: "Permission middleware working successfully"
    });
  }
);

module.exports = router;
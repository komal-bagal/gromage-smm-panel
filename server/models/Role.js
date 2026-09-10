const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      enum: ["admin", "user", "reseller", "staff"]
    },

    permissions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Permission"
      }
    ],

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Role", roleSchema);
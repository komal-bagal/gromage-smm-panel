const mongoose = require("mongoose");

const qrCodeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true
    },

    description: {
      type: String,
      default: "",
      trim: true
    },

    qrData: {
      type: String,
      required: true,
      trim: true
    },

    imageUrl: {
      type: String,
      default: "",
      trim: true
    },

    sortOrder: {
      type: Number,
      default: 0,
      index: true
    },

    isPublic: {
      type: Boolean,
      default: true,
      index: true
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  {
    timestamps: true
  }
);

const QrCode =
  mongoose.models.QrCode ||
  mongoose.model("QrCode", qrCodeSchema);

console.log("========== QR CODE MODEL LOADED ==========");
console.log("QrCode:", QrCode);
console.log("QrCode type:", typeof QrCode);
console.log("QrCode.findOne:", typeof QrCode.findOne);
console.log("QrCode.find:", typeof QrCode.find);
console.log("QrCode.create:", typeof QrCode.create);
console.log("QrCode.findById:", typeof QrCode.findById);
console.log("QrCode.findByIdAndUpdate:", typeof QrCode.findByIdAndUpdate);
console.log("QrCode.findByIdAndDelete:", typeof QrCode.findByIdAndDelete);
console.log("==========================================");

module.exports = QrCode;
const mongoose = require("mongoose");

const EquipmentSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: false,
      default: null,
    },
    number: {
      type: Number,
      required: [true, "Number is required"],
    },
    tableNumber: {
      type: String,
      required: [true, "Table Number is required"],
      trim: true,
    },
    assetNumber: {
      type: String,
      required: [true, "Asset Number is required"],
      unique: true,
      trim: true,
    },
    module: {
      type: String,
      required: [true, "Module is required"],
      trim: true,
    },
    size: {
      type: String,
      required: [true, "Size is required"],
      trim: true,
    },
    versionWin: {
      type: String,
      required: [true, "Version WIN is required"],
      trim: true,
    },
    versionCswin: {
      type: String,
      required: [true, "Version CSWIN is required"],
      trim: true,
    },
    versionDongle: {
      type: String,
      required: [true, "Version Dongle is required"],
      trim: true,
    },
    nomPc: {
      type: String,
      required: [true, "Nom PC is required"],
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const Equipment = mongoose.model("Equipment", EquipmentSchema);

module.exports = Equipment;

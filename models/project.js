const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Code is required"],
      unique: true,
      trim: true,
      index: true,
    },
    cmn: {
      type: String,
      required: [true, "Customer Material Number is required"],
      trim: true,
    },
    refTSK: {
      type: String,
      required: [true, "Ref TSK is required"],
      trim: true,
    },
    qte: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [0, "Quantity cannot be negative"],
    },
    pin: {
      type: String,
      required: [true, "Pin is required"],
      trim: true,
    },
    sap1: {
      type: String,
      trim: true,
      default: null,
    },
    sap2: {
      type: String,
      trim: true,
      default: null,
    },
    refS: {
      type: String,
      required: [true, "Ref Switcheur is required"],
      trim: true,
    },
    status: {
      type: String,
      enum: ["planned", "ongoing", "completed", "on-hold"],
      default: "planned",
    },
    equipments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Equipment",
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const Project = mongoose.model("Project", ProjectSchema);
module.exports = Project;

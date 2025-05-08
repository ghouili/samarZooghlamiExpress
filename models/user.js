const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Matricule = code
// 1rst Name	= firstName
// 2nd Name	= lastName
// Dept. = dept
// Projet	= project
// Position HR Sheet
// Position	= post
// Affectation = affectation

const UserSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      minlength: [2, "First name must be at least 2 characters"],
      maxlength: [50, "First name cannot exceed 50 characters"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
      minlength: [2, "Last name must be at least 2 characters"],
      maxlength: [50, "Last name cannot exceed 50 characters"],
    },
    code: {
      type: String,
      required: [true, "PK Code is required"],
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
      index: true,
    },
    post_hr: {
      type: String,
      trim: true,
      default: "Sampling",
    },
    post: {
      type: String,
      enum: [
        "Superviseur shift test system",
        "Agent Prototype",
        "Ingénieur Product",
        "Ingénieur Product",
        "Ingénieur Test",
        "Ingénieur Qualité",
        "Technicien Test",
        "Technicien Qualité",
        "Technicien Prototype",
        "Technicien process Equipements",
        "Technicien process Test",
        "Technicien process Qualité",
        "Technicien process Prototype",
        "Technicien process Autres",
        "Superviseur shift test system",
      ],
      required: [true, "Post is required"],
      default: null,
    },
    affectation: {
      type: String,
      enum: ["Administration", "Indirect"],
      trim: true,
      default: "Indirect",
    },
    dept: {
      type: String,
      enum: ["PPE", "CPE", "Qualite"],
      required: [true, "Post is required"],
      default: null,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    role: {
      type: String,
      enum: {
        values: ["user", "admin"],
        message: "{VALUE} is not a valid role",
      },
      default: "user",
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    picture: {
      type: String,
      default: "avatar.png",
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
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

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", UserSchema);
module.exports = User;

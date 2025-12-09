// models/User.js
import mongoose from "mongoose";

const providerSchema = new mongoose.Schema({
  id: { type: String, index: true, sparse: true },
  // store tokens only if you need them (optional)
  accessToken: { type: String },
  refreshToken: { type: String }
}, { _id: false });

const userSchema = new mongoose.Schema({
  email: { type: String, index: true, unique: true, sparse: true },
  name: { type: String },
  firstName: { type: String },
  lastName: { type: String },
  avatar: { type: String },

  // ✅ NEW FIELDS
    sex: {
      type: String,
      enum: ["male", "female", "other"],
      default: null,
    },
    birthday: {
      type: Date,
      default: null,
    },
  // provider-specific data (google, github, etc.)
  providers: {
    google: { type: providerSchema, default: null },
    // add other providers if needed
  },
  role: { type: String, default: "user" },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

// Add an index on providers.google.id for quick lookup
userSchema.index({ "providers.google.id": 1 }, { sparse: true });

export default mongoose.models.User || mongoose.model("User", userSchema);

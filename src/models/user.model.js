import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      match: [/^\d+$/, "Phone must contain only numbers"],
    },
    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    kycStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    deviceInfo: {
      ipAddress: { type: String },
      deviceType: {
        type: String,
        enum: ["Mobile", "Desktop"],
      },
      os: {
        type: String,
        enum: ["Android", "iOS", "Windows", "macOS"],
      },
    },
  },
  {
    timestamps: true,
  }
);

// Text index for search
userSchema.index({ fullName: "text", email: "text" });

// Compound index: optimizes queries that filter by isBlocked + kycStatus and sort by createdAt
// e.g., GET /api/users?isBlocked=false&kycStatus=Approved&sortBy=createdAt
userSchema.index({ isBlocked: 1, kycStatus: 1, createdAt: -1 });

const User = mongoose.model("User", userSchema);

export default User;

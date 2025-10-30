const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
    },
    message: {
      type: String,
      required: true,
    },
    userIsRead: {
      type: Boolean,
      default: false,
    },
    hospitalIsRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const notification = mongoose.model("Notification", notificationSchema);
module.exports = notification;
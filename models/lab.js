const mongoose = require("mongoose");
const Schema = mongoose.Schema;


const labSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true,
      match: [/\S+@\S+\.\S+/, "Please enter a valid email address"],
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      match: [/^\d{10}$/, "Please enter a valid 10-digit phone number"],
    },
    time: {
        starTime: {type: String, required: true},
        endTime: {type: String, required: true}
    },
    services: [{
      type: String,
      required: true,
    }],
    location: {
      place: { type: String, required: true },
      pincode: { type: Number, required: true },
    }
  },
  { timestamps: true }
);

const lab =  mongoose.model("Lab", labSchema);
module.exports = lab
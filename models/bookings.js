const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookingSchema = new Schema(
  {
      patient_name: { type: String },
      patient_phone: { type: String },
      patient_place: { type: String },
      patient_dob: { type: String },
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
        hospitalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hospital',
        required: true
      },
      specialty: { type: String },
      doctor_name: { type: String },
      booking_date: { type: Date },
      booking_time: { type: String },
      status: {
        type: String,
        enum: ["pending", "accepted", "declined", "cancel"],
      },

  },
  { timestamps: true }
);

const booking = mongoose.model("Booking", bookingSchema);
module.exports = booking
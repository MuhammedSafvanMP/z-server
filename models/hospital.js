const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const doctorSchema = new Schema({
  name: { type: String },
  qualification: { type: String },
  consulting: [
    {
      day: { type: String, required: true },
      sessions: [
        {
          start_time: { type: String, required: true },
          end_time: { type: String, required: true },
        },
      ],
    },
  ],
  bookingOpen: { type: Boolean, default: true }
});

// Speciality Schema
const specialtySchema = new Schema({
  name: { type: String },
  description: { type: String },
  department_info: { type: String },
  phone: { type: String },
  doctors: [doctorSchema],
});

// Review Schema
const reviewSchema = new Schema({
  user_id: { type: String, ref: "User", required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String },
  date: { type: String },
});

// Working Hours Schema
const workingHoursSchema = new Schema({
  day: { type: String },
  opening_time: {
    type: String,
    validate: {
      validator: function () {
        return (
          this.is_holiday || (this.opening_time && this.opening_time.length > 0)
        );
      },
      message: "Opening time is required unless it's a holiday.",
    },
  },
  closing_time: {
    type: String,
    validate: {
      validator: function () {
        return (
          this.is_holiday || (this.closing_time && this.closing_time.length > 0)
        );
      },
      message: "Closing time is required unless it's a holiday.",
    },
  },
  is_holiday: { type: Boolean, default: false },
});

// Working Hours Schema
const workingHoursClinicSchema = new Schema({
  day: { type: String },
  morning_session: {
    open: { type: String },
    close: { type: String },
  },
  evening_session: {
    open: { type: String },
    close: { type: String },
  },
  is_holiday: { type: Boolean, default: false },
  has_break: { type: Boolean, default: false }, // Flag to indicate if clinic has break
});

// Booking Schema
const bookingSchema = new Schema({
  patient_name: { type: String },
  patient_phone: { type: String },
  patient_place: { type: String },
  patient_dob: { type: String },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  specialty: { type: String },
  doctor_name: { type: String },
  booking_date: { type: Date },
  booking_time: { type: String },
  status: {
    type: String,
    enum: ["pending", "accepted", "declained", "cancel"],
  },
});

// Ads Schema
const adSchema = new Schema({
  title: { type: String }, // Optional
  imageUrl: { type: String, required: true },
  public_id: { type: String, required: true },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date },
  isActive: { type: Boolean, default: true },
});

adSchema.virtual("activeStatus").get(function () {
  if (!this.endDate) return this.isActive; // if no endDate, return stored isActive
  return this.endDate > new Date() && this.isActive;
});

// Hospital Schema
const hospitalSchema = new Schema({
  name: { type: String, required: true },
  type: { type: String, required: true }, // Homeo, Alopathy
  address: { type: String, required: true },
  password: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  emergencyContact: { type: String },
  image: { imageUrl: { type: String }, public_id: { type: String } },
  latitude: { type: Number },
  longitude: { type: Number },
  about: { type: String },
  working_hours: [workingHoursSchema],
  working_hours_clinic: [workingHoursClinicSchema],
  reviews: [reviewSchema],
  specialties: [specialtySchema],
  booking: [bookingSchema],
  ads: [adSchema],
});

// Create the model
const Hospital = mongoose.model("Hospital", hospitalSchema);
module.exports = Hospital;
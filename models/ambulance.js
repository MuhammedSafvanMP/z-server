const mongoose = require("mongoose");
const Schema = mongoose.Schema;



const ambulanceSchema = new Schema({
  serviceName: {
    type: String,
    required: true,
  },
    address: {
      country : { type: String},
      state:  { type: String},
      district: { type: String},
      place: { type: String, required: true },
      pincode: { type: Number, required: true },
    },
  phone: {
    type: String,
    required: true,
    unique: true,
  },
  vehicleType: {
    type: String,
  },
}, {timestamps: true});
const Ambulance = mongoose.model("Ambulance", ambulanceSchema);
module.exports = Ambulance;

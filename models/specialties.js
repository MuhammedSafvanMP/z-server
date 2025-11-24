const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const specialitySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    picture: { imageUrl: { type: String }, public_id: { type: String } },
  },
  { timestamps: true }
);

const speciality = mongoose.model("Specility", specialitySchema);
module.exports = speciality
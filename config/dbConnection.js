const mongoose  = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const connectToDb = async () => {
  try {
    mongoose
      .connect(process.env.MongoDB_String)
      .then(() => console.log("Connected to Database"));
  } catch (error) {}
};
module.exports =  connectToDb;

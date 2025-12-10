const bcrypt = require("bcrypt");
const Ambulance = require("../models/ambulance");
const Jwt = require("jsonwebtoken");

const Registeration = async (req, res) => {

  console.log(req.body, "hiiii");
  
  const {
    serviceName,
    address,
    phone,
    vehicleType,
  } = req.body;


  const exist = await Ambulance.findOne({ phone: phone });
  if (exist) {
      return res
    .status(404)
    .json({ message: "Ambulance is already exist" });
  }
  const newAmbulace = new Ambulance({
    serviceName: serviceName,
    address: address,
    phone: phone,
    vehicleType: vehicleType,
  });
  await newAmbulace.save();
  return res
    .status(201)
    .json({ message: "Registeration completed successfully" });
};

//Ambulance Login
const login = async (req, res) => {
  const { email, password } = req.body;
  
  const user = await Ambulance.findOne({ email: email });
  if (!user) {
      return res.status(404).json({
    message: "Ambulance not found! Please register"
  });
  }
  const checkPassword = await bcrypt.compare(password, user.password);
  if (!checkPassword) {
          return res.status(404).json({
    message: "Wrong password, Plese try again"
  });
  }
  const jwtKey = process.env.JWT_SECRET;
  if (!jwtKey) {
              return res.status(404).json({
    message: "JWT_SECRET is not defined"
  });
  }
  // Generate JWT tokens
  const token = Jwt.sign({ id: user._id, name: user.serviceName }, jwtKey, {
    expiresIn: "15m",
  });

  const refreshToken = Jwt.sign(
    { id: user._id, name: user.serviceName },
    jwtKey,
    {
      expiresIn: "7d",
    }
  );

  const sevenDayInMs = 7 * 24 * 60 * 60 * 1000;
  const expirationDate = new Date(Date.now() + sevenDayInMs);

 

  res.cookie("refreshToken", refreshToken, {
  httpOnly: true,
  expires: expirationDate,
  secure: process.env.NODE_ENV === "production", 
  sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
});


  return res.status(200).json({
    message: "Loggedin successfully",
    status: 200,
    data: user,
  });
};

// Get a specific ambulance details
const getanAmbulace = async (req, res) => {

  const user = await Ambulance.findById({_id: req.params.id});
  if (!user) {
      return res.status(404).json({
    message: "Ambulance not found"
  });
  }
  return res.status(200).json({
    status: "Success",
    data: user,
  });
};

const updateData = async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const ambulance = await Ambulance.findByIdAndUpdate(id, updateData, {
    new: true,
  });
  if (!ambulance)   return res.status(404).json({ message: "Ambulance not found", status: 200 });

  return res.status(200).json({ message: "successfully updated", ambulance });
};



// Delete Ambulance
const ambulanceDelete = async (req, res) => {
  const { id } = req.params;

  const hospital = await Ambulance.findById(id);
  if (!hospital) {
        return res.status(404).json({
    message: "Hospital not found"
  });
  }
  await Ambulance.findByIdAndDelete({ _id: id });
  return res.status(200).send({message: "Your account deleted successfully", status: 200});
};


// Get all ambulances
const getAmbulaces = async (req, res) => {
  const ambulances = await Ambulance.find();
  if (ambulances.length === 0) {
        return res.status(404).json({
    message: "No data found"
  });
  }
  return res.status(200).json({
    status: "Success",
    data: ambulances,
  });
};

// Get all ambulances
const forgetpassword = async (req, res) => {

  const { email } = req.body;

  try {
    const ambulance = await Ambulance.findOne({ email });

    if (!ambulance) {
      return res.status(404).json({
        message: "No data found",
      });
    }

    return res.status(200).json({
      status: 200,
      data: ambulance,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      message: "Server error",
    });
  }
};


const changepassword = async (req, res) => {
  try {

    const { password, email } = req.body;

    const ambulances = await Ambulance.findOne({ email });

    if (!ambulances) {
      return res.status(404).json({ message: "No data found" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    ambulances.password = hashedPassword;

    await ambulances.save();

    return res.status(200).json({
      status: 200,
      data: ambulances,
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Server Error", error });
  }
};



module.exports = {
  Registeration,
  login,
  getanAmbulace,
  updateData,
  ambulanceDelete,
  getAmbulaces,
  forgetpassword,
  changepassword
};
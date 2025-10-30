const Joi = require("joi");
const HttpError = require("http-errors");
const bcrypt = require("bcrypt");
const Jwt = require("jsonwebtoken");
const User = require("../models/user");
const Hospital = require("../models/hospital");
const twilio = require("twilio");
require("dotenv").config();

const otpStorage = new Map();

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Joi schema to validate the Registration data of users
const joiSchema = Joi.object({
  name: Joi.string().trim().required().messages({
    "string.empty": "Name is required",
  }),

  email: Joi.string().email().lowercase().trim().required().messages({
    "string.email": "Please enter a valid email address",
    "string.empty": "Email is required",
  }),

  password: Joi.string().min(8).messages({
    "string.min": "Password must be at least 8 characters long",
    "string.empty": "Password is required",
  }),

  phone: Joi.string()
    .pattern(/^\d{10}$/)
    .messages({
      "string.pattern.base": "Please enter a valid 10-digit phone number",
      "string.empty": "Phone number is required",
    }),
});

// User Registration
const userRegister = async (req, res) => {
  const { error } = joiSchema.validate(req.body);
  if (error) {
    throw new HttpError.BadRequest(error.details[0].message);
  }

  const existingUser = await User.findOne({
    email: req.body.email,
  });
  if (existingUser) {
    throw new HttpError.Conflict("Email is already registered, Please login");
  }
  const hashedPassword = await bcrypt.hash(req.body.password, 10);
  const newUser = new User({
    ...req.body,
    password: hashedPassword,
  });

  await newUser.save();

  return res.status(201).json({
    staus: "Success",
    message: "User created successfully",
  });
};

// User's login
const userLogin = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email });
  if (user === null) {
    throw new HttpError.NotFound("You email is not found, Please Register");
  }
  const passwordCheck = await bcrypt.compare(password, user.password);
  if (!passwordCheck) {
    throw new HttpError.BadRequest("Incorrect password, try again!");
  }
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not defined");
  }

  const token = Jwt.sign({ id: user._id, name: user.name }, jwtSecret, {
    expiresIn: "15m",
  });

  const refreshToken = Jwt.sign({ id: user._id, name: user.name }, jwtSecret, {
    expiresIn: "7d",
  });

  const sevenDayInMs = 7 * 24 * 60 * 60 * 1000;
  const expirationDate = new Date(Date.now() + sevenDayInMs);
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    expires: expirationDate,
    secure: true,
    sameSite: "none",
  });

  return res.status(200).json({
    status: "Success",
    token: token,
    data: user,
    message: "You logged in successfully.",
  });
};

const login = async (req, res) => {
  let phone = req.body.phone;

  try {
    // Check if customer exists
    const user = await User.findOne({ phone: String(phone).trim() });

    if (!user) {
      return res.status(400).json({ message: "Phone number not registered!" });
    }

    // Ensure +91 prefix with space
    if (!phone.startsWith("+91")) {
      phone = "+91 " + phone.replace(/^\+91\s*/, "").trim();
    }

    if(phone == "+91 9400517720"){
      otpStorage.set(phone, 123456); 

      return res
        .status(200)
        .json({ message: `OTP sent successfully ${123456}`, status: 200 });
    } 

    // Generate OTP (6-digit random number)
    const otp = Math.floor(100000 + Math.random() * 900000);
    otpStorage.set(phone, otp); // Store OTP temporarily

    // Send OTP via Twilio
    await client.messages.create({
      body: `Your verification code is: ${otp}`,
      from: process.env.TWLIO_NUMBER,
      to: phone,
    });

    return res
      .status(200)
      .json({ message: `OTP sent successfully ${otp}`, status: 200 });
  } catch (error) {
    console.error("Twilio Error:", error);
    return res
      .status(500)
      .json({ message: "Failed to send OTP", error: error, status: 500 });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ message: "Phone and OTP are required" });
    }

    // Ensure +91 prefix
    const formattedPhone = phone.startsWith("+91")
      ? phone
      : "+91 " + phone.replace(/^\+91\s*/, "").trim();

    // Validate OTP
    const storedOtp = otpStorage.get(formattedPhone);

    if (!storedOtp || storedOtp.toString().trim() !== otp.toString().trim()) {
      return res
        .status(400)
        .json({ message: `Invalid or expired OTP ${otp},${storedOtp}` });
    }

    // Remove OTP from storage
    otpStorage.delete(formattedPhone);

    // Find customer
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(400).json({ message: "Customer not found" });
    }

    // Generate JWT
    const token = Jwt.sign(
      { email: user.email, id: user._id },
      process.env.JWT_SECRET || "myjwtsecretkey",
      { expiresIn: "1h" }
    );

    const userDetails = {
      name: user.name,
      email: user.email,
      _id: user._id,
      phone: user.phone,
      picture: user?.picture,
    };

    return res.status(200).json({
      message: "OTP verified successfully",
      token,
      userDetails,
      status: 200,
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    return res.status(500).json({ error: "Server error, please try again" });
  }
};

// Get user data
const userData = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) {
    throw new HttpError.Unauthorized("Please login!");
  }
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error("JWT_SECRET is not defined");
  }

  const { id } = Jwt.verify(token, jwtSecret);

  const data = await User.findById(id);
  return res.status(200).json({
    status: "success",
    data: data,
  });
};

const aUserData = async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    throw new HttpError.NotFound("User not found");
  }

  return res.status(200).json({
    status: "success",
    data: user,
  });
};

// Reset Password
const resetPassword = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    throw new HttpError.NotFound("User not found");
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  user.password = hashedPassword;
  await user.save();
  return res.status(200).json({ message: "Password reset successful." });
};

// Get details of all hospitals
const getHospitals = async (req, res) => {
  console.log("Sample from native");

  const hospitals = await Hospital.find().populate({
    path: "reviews.user_id",
    select: "name email",
  });
  return res.status(200).json({ data: hospitals });
};

// Post a review
const postReview = async (req, res) => {
  const { user_id, rating, comment, date } = req.body;
  const { id } = req.params;

  const hospital = await Hospital.findById(id);
  if (!hospital) {
    throw new HttpError.NotFound("Hospital not found");
  }

  hospital.reviews.push({ user_id, rating, comment, date });

  await hospital.save();
  const updatedHospital = await hospital.populate({
    path: "reviews.user_id",
    select: "name email",
  });

  return res.status(200).json({
    message: "Review posted successfully",
    data: updatedHospital,
  });
};

const editReview = async (req, res) => {
  const { hospital_id, reviewId } = req.params;
  const { rating, comment } = req.body;
  const hospital = await Hospital.findById(hospital_id);
  if (!hospital) {
    throw new HttpError.NotFound("Hospital not found");
  }
  const index = hospital.reviews.findIndex(
    (element) => element._id.toString() === reviewId
  );
  if (index === -1) {
    throw new HttpError.NotFound("Review not found");
  }
  hospital.reviews[index].rating = rating;
  hospital.reviews[index].comment = comment;
  hospital.reviews[index].date = new Date().toISOString();

  await hospital.save();

  const updatedHospital = await hospital.populate({
    path: "reviews.user_id",
    select: "name email",
  });
  return res.status(200).json({
    message: "Review updated successfully",
    data: updatedHospital,
  });
};

const deleteReview = async (req, res) => {
  const { hospital_id, reviewId } = req.params;
  const hospital = await Hospital.findById(hospital_id);
  if (!hospital) {
    throw new HttpError.NotFound("Hospital not found");
  }
  const index = hospital.reviews.findIndex(
    (element) => element._id.toString() === reviewId
  );
  if (index === -1) {
    throw new HttpError.NotFound("Review not found");
  }

  hospital.reviews.splice(index, 1);

  await hospital.save();

  const updatedHospital = await hospital.populate({
    path: "reviews.user_id",
    select: "name email",
  });
  return res.status(200).json({
    message: "Review deleted successfully",
    data: updatedHospital,
  });
};

const saveExpoToken = async (req, res) => {
  try {
    const { id } = req.params;
    const { expoPushToken } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      { expoPushToken },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ message: "Expo token updated", user });
  } catch (error) {
    console.error("Error saving expo token:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

module.exports = {
  userRegister,
  userLogin,
  login,
  verifyOtp,
  userData,
  aUserData,
  resetPassword,
  getHospitals,
  postReview,
  editReview,
  deleteReview,
  saveExpoToken
};
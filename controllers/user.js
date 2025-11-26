const Joi = require("joi");
const HttpError = require("http-errors");
const bcrypt = require("bcrypt");
const Jwt = require("jsonwebtoken");
const User = require("../models/user");
const Review = require("../models/review");
const Hospital = require("../models/hospital");
const Blood = require("../models/blood");
const twilio = require("twilio");
const { getIO } = require("../sockets/socket");
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
     return res.status(400).json({message: error.details[0].message});
  }

  const existingUser = await User.findOne({
    email: req.body.email,
  });
  if (existingUser) {
    return res.status(400).json({ message: "Email is already registered, Please login" });
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
    return res.status(404).json({ message: "You email is not found, Please Register"});
  }
  const passwordCheck = await bcrypt.compare(password, user.password);
  if (!passwordCheck) {
    return res.status(404).json({ message: "Incorrect password, try again!"});

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
      secure: process.env.NODE_ENV === "production", 
  sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
  });

  return res.status(200).json({
    status: "Success",
    token: token,
    data: user,
    message: "You logged in successfully.",
  });
};

// const login = async (req, res) => {


//   // let phone = req.body.phone;

//   try {
//     // // Check if customer exists
//     // const user = await User.findOne({ phone: String(phone).trim() });

//     // if (!user) {
//     //   return res.status(400).json({ message: "Phone number not registered!" });
//     // }

//     let phone = req.body.phone;   // ex: "+919567900329"
//     let phoneChecking;

// // Remove all non-numeric characters
// phoneChecking = phone.replace(/\D/g, "");

// // Always take last 10 digits
// phoneChecking = phone.slice(-10);


// // Now search in DB
// const user = await User.findOne({ phone: phoneChecking });

// if (!user) {
//       return res.status(400).json({ message: "Phone number not registered!" });
//     }

//     // Generate OTP (6-digit random number)
//     const otp = Math.floor(100000 + Math.random() * 900000);
//     otpStorage.set(phone, otp); // Store OTP temporarily

//     // Send OTP via Twilio
//     await client.messages.create({
//       body: `Your verification code is: ${otp}`,
//       from: process.env.TWLIO_NUMBER,
//       to: phone,
//     });

//     return res
//       .status(200)
//       .json({ message: `OTP sent successfully ${otp}`, status: 200 });
//   } catch (error) {
//     console.error("Twilio Error:", error);
//     return res
//       .status(500)
//       .json({ message: "Failed to send OTP", error: error, status: 500 });
//   }
// };

// const verifyOtp = async (req, res) => {
//   try {
//     const { phone, otp, FcmToken } = req.body;

    
//     if (!phone || !otp) {
//       return res.status(400).json({ message: "Phone and OTP are required" });
//     }

//     console.log(phone, otp, "hiiii");
    

//     // Ensure +91 prefix
//     const formattedPhone = phone.startsWith("+91")
//       ? phone
//       : "+91 " + phone.replace(/^\+91\s*/, "").trim();

//     // Validate OTP
//     const storedOtp = otpStorage.get(formattedPhone);

//     if (!storedOtp || storedOtp.toString().trim() !== otp.toString().trim()) {
//       return res
//         .status(400)
//         .json({ message: `Invalid or expired OTP ${otp},${storedOtp}` });
//     }

//     // Remove OTP from storage
//     otpStorage.delete(formattedPhone);


//     let phoneChecking;

// // Remove all non-numeric characters
// phoneChecking = phone.replace(/\D/g, "");

// // Always take last 10 digits
// phoneChecking = phone.slice(-10);


// // Now search in DB
// const user = await User.findOne({ phone: phoneChecking });

//     // Find customer
//     if (!user) {
//       return res.status(400).json({ message: "User not found" });
//     }

//     user.FcmToken = FcmToken;
//     await user.save();

//     const bloodDonor = await Blood.findOne({userId:  user._id});    

//     // Generate JWT
//     const token = Jwt.sign(
//       { email: user.email, id: user._id },
//       process.env.JWT_SECRET || "myjwtsecretkey",
//       { expiresIn: "1h" }
//     );

//     const userDetails = {
//       name: user.name,
//       email: user.email,
//       _id: user._id,
//       phone: user.phone,
//       picture: user?.picture,
//       donorId: bloodDonor ? bloodDonor._id : null 
//     };

//     return res.status(200).json({
//       message: "OTP verified successfully",
//       token,
//       userDetails,
//       status: 200,
//     });
//   } catch (err) {
//     console.error("Verify OTP error:", err);
//     return res.status(500).json({ error: "Server error, please try again" });
//   }
// };


// TEST NUMBER FOR APPLE REVIEW
const APPLE_TEST_NUMBER = "9999999999";
const APPLE_TEST_OTP = "123456";

const login = async (req, res) => {
  try {
    let phone = req.body.phone || "";
    
    // Extract digits only
    let numericPhone = phone.replace(/\D/g, ""); 

    // Always take last 10 digits (real mobile number)
    numericPhone = numericPhone.slice(-10);

    if (!numericPhone) {
      return res.status(400).json({ message: "Invalid phone number" });
    }

    // Apple Test Account -> Bypass SMS
    if (numericPhone === APPLE_TEST_NUMBER) {
      otpStorage.set(numericPhone, APPLE_TEST_OTP);
      return res.status(200).json({
        message: `OTP sent successfully (TEST ACCOUNT)`,
        otp: APPLE_TEST_OTP,
        status: 200,
      });
    }

    // Check if user exists
    const user = await User.findOne({ phone: numericPhone });
    if (!user) {
      return res.status(400).json({ message: "Phone number not registered!" });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000);
    otpStorage.set(numericPhone, otp);

    // Send OTP through Twilio
    await client.messages.create({
      body: `Your verification code is: ${otp}`,
      from: process.env.TWLIO_NUMBER,
      to: "+91" + numericPhone,
    });

    return res.status(200).json({
      message: `OTP sent successfully`,
      status: 200,
    });

  } catch (error) {
    console.error("Twilio Error:", error);
    return res.status(500).json({ message: "Failed to send OTP", error });
  }
};



const verifyOtp = async (req, res) => {
  try {
    const { phone, otp, FcmToken } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ message: "Phone and OTP are required" });
    }

    // Normalize phone number
    let numericPhone = phone.replace(/\D/g, "").slice(-10);

    // VALIDATE OTP
    const storedOtp = otpStorage.get(numericPhone);

    if (!storedOtp || storedOtp.toString() !== otp.toString()) {
      return res.status(400).json({
        message: `Invalid or expired OTP`,
      });
    }

    otpStorage.delete(numericPhone);

    // Fetch user
    const user = await User.findOne({ phone: numericPhone });
    if (!user) return res.status(400).json({ message: "User not found" });

    user.FcmToken = FcmToken;
    await user.save();

    const bloodDonor = await Blood.findOne({ userId: user._id });

    // JWT Token
    const token = Jwt.sign(
      { email: user.email, id: user._id },
      process.env.JWT_SECRET || "myjwtsecretkey",
      { expiresIn: "1h" }
    );

    return res.status(200).json({
      message: "OTP verified successfully",
      token,
      userDetails: {
        name: user.name,
        email: user.email,
        _id: user._id,
        phone: user.phone,
        picture: user.picture,
        donorId: bloodDonor ? bloodDonor._id : null,
      },
      status: 200,
    });

  } catch (err) {
    console.error("Verify OTP error:", err);
    return res.status(500).json({ error: "Server error, please try again" });
  }
};



// Get user data
const userData = async (req, res) => {

  const data = await User.find();
  return res.status(200).json({
    status: "success",
    data: data,
  });
};

const aUserData = async (req, res) => {
  const user = await User.findById(req.params.id);
  

  if (!user) {
    return res.status(404).json({ message:"User not found"});
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

  const hospitals = await Hospital.find().populate({
    path: "reviews.user_id",
    select: "name email",
  });
  return res.status(200).json({ data: hospitals });
};

// Post a review
const postReview = async (req, res) => {
  const { userId, rating, comment, hospitalId } = req.body;


  const hospital = await Hospital.findById(hospitalId);
  if (!hospital) {
    throw new HttpError.NotFound("Hospital not found");
  }

   const review = await Review.create({ userId, rating, comment, hospitalId });

  return res.status(201).json({
    message: "Review created successfully",
    data: review,
  });
};



const getReviews = async (req, res) => {
 
  const review = await Review.findById();
  if (!review) {
    throw new HttpError.NotFound("Reviews not found");
  }

  return res.status(201).json({
    message: "Review created successfully",
    data: review,
  });
};



const getReviewsAHospital = async (req, res) => {
   
  const {id } = req.params;

   
  const review = await Review.find({ hospitalId: id }).populate("userId");
  if (!review) {
    throw new HttpError.NotFound("Reviews not found");
  }
  
  return res.status(201).json({
    message: "Review created successfully",
    data: review,
  });
};

const editReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    // Find review by ID
    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    // Update only the provided fields
    if (rating !== undefined) review.rating = rating;
    if (comment !== undefined) review.comment = comment;

    // Save updated review
    await review.save();

    return res.status(200).json({
      message: "Review updated successfully",
      data: review,
    });
  } catch (error) {
    console.error("Error updating review:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;

    const review = await Review.findByIdAndDelete(id);

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    return res.status(200).json({
      message: "Review deleted successfully",
      data: review,
    });
  } catch (error) {
    console.error("Error deleting review:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
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


const test = async (req, res) => {
  try {
    const { id }  = req.params;

     const io = getIO();
    io.emit("pushNotificationPhone", {
      userId: id,
       message: `Your booking accepted`,
    });
    
    
  } catch (error) {
    console.error("Error saving expo token:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};



const aUserDelete = async (req, res) => {

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

   await User.findByIdAndDelete(req.params.id);
    
  return res.status(200).json({
    status: "success",
    message: "User deleted successfully"
  });
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
  saveExpoToken,
  getReviews,
  getReviewsAHospital,
  test,
  aUserDelete
};
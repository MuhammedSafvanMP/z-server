const express = require("express");
const {
  deleteReview,
  editReview,
  getHospitals,
  postReview,
  resetPassword,
  userData,
  userLogin,
  userRegister,
  login,
  verifyOtp,
  aUserData,
  saveExpoToken 
} = require("../controllers/user");
const { trycatch } = require("../utils/tryCatch");
const Auth = require("../middlewares/authentication");
const { uploadProfile } = require("../middlewares/multer");

const userRoutes = express.Router();

userRoutes.post("/users/registeration", trycatch(userRegister));
userRoutes.post("/users/login", trycatch(userLogin));
userRoutes.post("/users/login/phone", trycatch(login));
userRoutes.post("/users/password", Auth, trycatch(resetPassword));
userRoutes.get("/users", Auth, trycatch(userData));
userRoutes.get("/users/:id", trycatch(aUserData));
userRoutes.put("/users/:id", trycatch(uploadProfile));
userRoutes.get("/hospitals", trycatch(getHospitals));
userRoutes.post("/reviews/:id", trycatch(postReview));
userRoutes.put("/reviews/:hospital_id/:reviewId", trycatch(editReview));
userRoutes.delete(
  "/reviews/:hospital_id/:reviewId",
  trycatch(deleteReview)
);

userRoutes.post("/users/otp", trycatch(verifyOtp));
userRoutes.post("/users/:id/token", trycatch(saveExpoToken));

module.exports = userRoutes;
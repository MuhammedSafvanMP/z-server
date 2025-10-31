const Express = require("express");
const { trycatch } = require("../utils/tryCatch");
const {
  addDoctor,
  addSpecialty,
  deleteDoctor,
  deleteSpecialty,
  getHospitalDetails,
  hospitalDelete,
  HospitalLogin,
  HospitalRegistration,
  resetPassword,
  updateDoctor,
  updateHospitalDetails,
  updateSpecialty,
  login,
  verifyOtp,
  createBooking,
  updateBooking,
  getBookingsByUserId,
    getSingleHospital

} = require("../controllers/hospetal");
const { uploadImage } = require("../middlewares/multer");
const Authenticator = require("../middlewares/authentication");

const hospitalRoutes = Express.Router();

hospitalRoutes.post("/hospital/registration", trycatch(HospitalRegistration));
hospitalRoutes.post("/hospital/login", trycatch(login));
hospitalRoutes.post("/hospital/otp", trycatch(verifyOtp));
hospitalRoutes.post("/hospital/login/mail", trycatch(HospitalLogin));
hospitalRoutes.get("/hospital/:id", trycatch(getSingleHospital));


hospitalRoutes.post(
  "/hospital/password",
  trycatch(resetPassword)
);
hospitalRoutes.get(
  "/hospital/details",
  Authenticator,
  trycatch(getHospitalDetails)
);
hospitalRoutes.put(
  "/hospital/details/:id",
  Authenticator,
  trycatch(updateHospitalDetails)
);
hospitalRoutes.post(
  "/hospital/specialty/:id",
  Authenticator,
  trycatch(addSpecialty)
);
hospitalRoutes.put(
  "/hospital/specialty/:id",
  Authenticator,
  trycatch(updateSpecialty)
);
hospitalRoutes.delete(
  "/hospital/specialty/:id",
  Authenticator,
  trycatch(deleteSpecialty)
);
hospitalRoutes.post(
  "/hospital/profileImage/:id",
  Authenticator,
  trycatch(uploadImage)
);
hospitalRoutes.post("/hospital/doctor/:id", Authenticator, trycatch(addDoctor));
hospitalRoutes.put(
  "/hospital/doctor/:id",
  Authenticator,
  trycatch(updateDoctor)
);
hospitalRoutes.delete(
  "/hospital/doctor/:hospital_id/:doctor_id",
  Authenticator,
  trycatch(deleteDoctor)
);
hospitalRoutes.delete("/hospital/:id", Authenticator, trycatch(hospitalDelete));

hospitalRoutes.post("/bookings/:id", trycatch(createBooking)); 
hospitalRoutes.put("/bookings/:bookingId/hospital/:hospitalId", trycatch(updateBooking));
hospitalRoutes.get("/bookings/user/:userId", trycatch(getBookingsByUserId));

module.exports = hospitalRoutes;
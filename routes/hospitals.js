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
  getHospitalDataSearch,
  getHospitalDoctors,
  getSingleHospital,
  getBookingsByHospitalId

} = require("../controllers/hospetal");
const { uploadImage, upload } = require("../middlewares/multer");
const Authenticator = require("../middlewares/authentication");

const hospitalRoutes = Express.Router();

hospitalRoutes.post("/hospital/registration", trycatch(HospitalRegistration));
hospitalRoutes.post("/hospital/login", trycatch(login));
hospitalRoutes.post("/hospital/otp", trycatch(verifyOtp));
hospitalRoutes.post("/hospital/login/mail", trycatch(HospitalLogin));

hospitalRoutes.get(
  "/hospital/doctors",
  trycatch(getHospitalDoctors)
);

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


hospitalRoutes.get(
  "/hospital/filter/:search",
  trycatch(getHospitalDataSearch)
);




hospitalRoutes.put(
  "/hospital/details/:id", upload.single('image'),
  trycatch(updateHospitalDetails)
);
hospitalRoutes.post(
  "/hospital/specialty/:id",
  trycatch(addSpecialty)
);
hospitalRoutes.put(
  "/hospital/:id/specialty/:specialityId",
  trycatch(updateSpecialty)
);
hospitalRoutes.delete(
  "/hospital/:id/specialty/:specialityId",
  trycatch(deleteSpecialty)
);


hospitalRoutes.post(
  "/hospital/profileImage/:id",
  Authenticator,
  trycatch(uploadImage)
);
hospitalRoutes.post("/hospital/doctor/:id",  trycatch(addDoctor));
hospitalRoutes.put(
  "/hospital/:hospitalId/specialty/:specialtyId/doctors/:doctorId",
  trycatch(updateDoctor)
);
hospitalRoutes.delete(
  "/hospital/:hospitalId/specialty/:specialtyId/doctors/:doctorId",
  trycatch(deleteDoctor)
);
hospitalRoutes.delete("/hospital/:id", Authenticator, trycatch(hospitalDelete));

hospitalRoutes.post("/bookings/:id", trycatch(createBooking)); 
hospitalRoutes.put("/bookings/:bookingId/hospital/:hospitalId", trycatch(updateBooking));
hospitalRoutes.get("/bookings/user/:userId", trycatch(getBookingsByUserId));
hospitalRoutes.get("/bookings/hospital/:hospitalId", trycatch(getBookingsByHospitalId));



module.exports = hospitalRoutes;
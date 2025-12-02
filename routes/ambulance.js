const express = require("express");
const { trycatch } = require("../utils/tryCatch");
const {
  ambulanceDelete,
  getAmbulaces,
  getanAmbulace,
  login,
  Registeration,
  updateData,
  forgetpassword,
  changepassword,
} = require("../controllers/ambulance");

const AmbulanceRoutes = express.Router();

AmbulanceRoutes.post("/ambulance/register", trycatch(Registeration));
AmbulanceRoutes.post("/ambulance/login", trycatch(login));
AmbulanceRoutes.put("/ambulance/changepassword", trycatch(changepassword));
AmbulanceRoutes.get("/ambulance/:id", trycatch(getanAmbulace));
AmbulanceRoutes.get("/ambulance", trycatch(getAmbulaces));
AmbulanceRoutes.put("/ambulance/:id", trycatch(updateData));
AmbulanceRoutes.delete("/ambulance/:id", trycatch(ambulanceDelete));
AmbulanceRoutes.post("/ambulance/forgot", trycatch(forgetpassword));


module.exports = AmbulanceRoutes;
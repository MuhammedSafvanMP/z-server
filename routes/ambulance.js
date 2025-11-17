const express = require("express");
const { trycatch } = require("../utils/tryCatch");
const {
  ambulanceDelete,
  getAmbulaces,
  getanAmbulace,
  login,
  Registeration,
  updateData,
} = require("../controllers/ambulance");

const AmbulanceRoutes = express.Router();

AmbulanceRoutes.post("/ambulance/register", trycatch(Registeration));
AmbulanceRoutes.post("/ambulance/login", trycatch(login));
// AmbulanceRoutes.get("/ambulance", trycatch(getanAmbulace));
AmbulanceRoutes.get("/ambulance", trycatch(getAmbulaces));
AmbulanceRoutes.put("/ambulance/:id", trycatch(updateData));
AmbulanceRoutes.delete("/ambulance/:id", trycatch(ambulanceDelete));

module.exports = AmbulanceRoutes;
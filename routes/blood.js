const express = require("express");
const { 
  createDonor, 
  deleteDonor, 
  getDonorId, 
  getDonors, 
  getSingleDonor, 
  updateDonor 
} = require("../controllers/blood");
const { trycatch } = require("../utils/tryCatch");

const router = express.Router();

router.post("/donors", trycatch(createDonor));
router.get("/donors", trycatch(getDonors));
router.get("/donors/:id", trycatch(getSingleDonor));
router.get("/donors/users/:id", trycatch(getDonorId));
router.put("/donors/:id", trycatch(updateDonor));
router.delete("/donors/:id", trycatch(deleteDonor));

module.exports = router;
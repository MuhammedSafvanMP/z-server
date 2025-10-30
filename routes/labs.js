const express = require("express");
const {
  createLab,
  getLabs,
  getSingleLab,
  updateLab,
  deleteLab,
} = require("../controllers/lab");
const { trycatch } = require("../utils/tryCatch");

const router = express.Router();

router.post("/lab", trycatch(createLab));
router.get("/lab", trycatch(getLabs));
router.get("/lab/:id", trycatch(getSingleLab));
router.put("/lab/:id", trycatch(updateLab));
router.delete("/lab/:id", trycatch(deleteLab));

module.exports = router;
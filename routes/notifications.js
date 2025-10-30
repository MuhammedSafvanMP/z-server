const express = require('express');
const router = express.Router();
const { 
  getUserUnread, 
  getHospitalUnread, 
  getUserRead, 
  getHospitalRead, 
  updateHospital, 
  updateUser, 
  updateUserAll, 
  updateHospitalAll 
} = require('../controllers/hospetal');

const { trycatch } = require("../utils/tryCatch");

router.get('/notifications/user/no-read/:id', trycatch(getUserUnread));
router.get('/notifications/hospital/no-read/:id', trycatch(getHospitalUnread));
router.get('/notifications/user/read/:id', trycatch(getUserRead));
router.get('/notifications/hospital/read/:id', trycatch(getHospitalRead));
router.patch('/notifications/user/:id', trycatch(updateUser));
router.patch('/notifications/user/read-all/:id', trycatch(updateUserAll));
router.patch('/notifications/hospital/read-all/:id', trycatch(updateHospitalAll));
router.patch('/notifications/hospital/:id', trycatch(updateHospital));

module.exports = router;
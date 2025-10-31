const express = require('express');
const { 
  getUserUnread, 
  getHospitalUnread, 
  getUserRead, 
  getHospitalRead, 
  updateHospital, 
  updateUser, 
  updateUserAll, 
  updateHospitalAll 
} = require('../controllers/notification');

const { trycatch } = require("../utils/tryCatch");

const notificationRoutes = express.Router();


notificationRoutes.get('/notifications/user/no-read/:id', trycatch(getUserUnread));
notificationRoutes.get('/notifications/hospital/no-read/:id', trycatch(getHospitalUnread));
notificationRoutes.get('/notifications/user/read/:id', trycatch(getUserRead));
notificationRoutes.get('/notifications/hospital/read/:id', trycatch(getHospitalRead));
notificationRoutes.patch('/notifications/user/:id', trycatch(updateUser));
notificationRoutes.patch('/notifications/user/read-all/:id', trycatch(updateUserAll));
notificationRoutes.patch('/notifications/hospital/read-all/:id', trycatch(updateHospitalAll));
notificationRoutes.patch('/notifications/hospital/:id', trycatch(updateHospital));

module.exports = notificationRoutes;
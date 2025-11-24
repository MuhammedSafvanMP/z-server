const express = require('express');
const { 
 getSpcilities,
   getASpcilities,
   deleteASpcilities
} = require('../controllers/specialites');
const {   uploadSpeciality, addASpeciality} = require("../middlewares/multer");


const { trycatch } = require("../utils/tryCatch");

const notificationRoutes = express.Router();


notificationRoutes.get('/speciality', trycatch(getSpcilities));
notificationRoutes.post('/speciality', trycatch(addASpeciality));
notificationRoutes.get('/speciality/:id', trycatch(getASpcilities));
notificationRoutes.patch('/speciality/:id', trycatch(uploadSpeciality));
notificationRoutes.delete('/speciality/:id', trycatch(deleteASpcilities));


module.exports = notificationRoutes;
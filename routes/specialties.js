const express = require('express');
const { 
 getSpcilities,
   getASpcilities,
   deleteASpcilities
} = require('../controllers/specialites');
const {   uploadSpeciality, addASpeciality, upload} = require("../middlewares/multer");


const { trycatch } = require("../utils/tryCatch");

const notificationRoutes = express.Router();


notificationRoutes.get('/speciality', trycatch(getSpcilities));
notificationRoutes.post('/speciality', upload.single('image'), trycatch(addASpeciality));
notificationRoutes.get('/speciality/:id', trycatch(getASpcilities));
notificationRoutes.put('/speciality/:id', upload.single('image'), trycatch(uploadSpeciality));
notificationRoutes.delete('/speciality/:id', trycatch(deleteASpcilities));


module.exports = notificationRoutes;
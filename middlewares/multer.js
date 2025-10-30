const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const createError = require("http-errors");
const path = require("path");
const Hospital = require("../models/hospital");
const userModel = require("../models/user");

const storage = multer.diskStorage({});
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 5, // 5MB file size limit
  },
});

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadFile = (req, res) => {
  return new Promise((resolve, reject) => {
    upload.single("image")(req, res, (err) => {
      if (err) {
        return reject(err);
      }
      resolve(req.file);
    });
  });
};

const uploadImage = async (req, res) => {
  const { id } = req.params;

  const file = await uploadFile(req, res);

  const hospital = await Hospital.findById(id);
  if (!hospital) {
    throw new createError.NotFound("Hospital not found!");
  }

  // If there's an existing image, delete it from Cloudinary
  if (hospital.image?.public_id) {
    await cloudinary.uploader.destroy(hospital.image.public_id);
  }

  if (file) {
    const normalizedPath = path.normalize(file.path);
    const result = await cloudinary.uploader.upload(normalizedPath);

    hospital.image = {
      imageUrl: result.secure_url,
      public_id: result.public_id,
    };
    await hospital.save();

    return res.status(200).json({ imageUrl: result.secure_url });
  } else {
    throw new createError.BadRequest("No file uploaded!");
  }
};

const uploadProfile = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  const file = await uploadFile(req, res);

  const user = await userModel.findById(id);
  if (!user) {
    throw new createError.NotFound("User not found!");
  }

  // Update name even if no file
  if (name) {
    user.name = name;
  }

  if (file) {
    // delete old image if exists
    if (user.picture?.public_id) {
      await cloudinary.uploader.destroy(user.picture.public_id);
    }

    const normalizedPath = path.normalize(file.path);
    const result = await cloudinary.uploader.upload(normalizedPath);

    user.picture = {
      imageUrl: result.secure_url,
      public_id: result.public_id,
    };
  }

  await user.save();

  return res.status(200).json({
    message: "Profile updated successfully",
    user, // return whole updated user, not just image
  });
};

module.exports = {
  upload,
  uploadFile,
  uploadImage,
  uploadProfile
};
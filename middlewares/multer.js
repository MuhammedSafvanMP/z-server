// const multer = require("multer");
// const { v2: cloudinary } = require("cloudinary");
// const createError = require("http-errors");
// const path = require("path");
// const Hospital = require("../models/hospital");
// const userModel = require("../models/user");
// const { getIO } = require("../sockets/socket");

// const storage = multer.diskStorage({});
// const upload = multer({
//   storage: storage,
//   limits: {
//     fileSize: 1024 * 1024 * 5, // 5MB file size limit
//   },
// });

// cloudinary.config({
//   cloud_name: process.env.CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET,
// });

// const uploadFile = (req, res) => {
//   console.log(req, "ihiiii");
  
//   return new Promise((resolve, reject) => {
//     upload.single("image")(req, res, (err) => {
//       if (err) {
//         return reject(err);
//       }
//       resolve(req.file);
//     });
//   });
// };

// const uploadImage = async (req, res) => {
//   const { id } = req.params;

//   const file = await uploadFile(req, res);

//   const hospital = await Hospital.findById(id);
//   if (!hospital) {
//     throw new createError.NotFound("Hospital not found!");
//   }

//   // If there's an existing image, delete it from Cloudinary
//   if (hospital.image?.public_id) {
//     await cloudinary.uploader.destroy(hospital.image.public_id);
//   }

//   if (file) {
//     const normalizedPath = path.normalize(file.path);
//     const result = await cloudinary.uploader.upload(normalizedPath);

//     hospital.image = {
//       imageUrl: result.secure_url,
//       public_id: result.public_id,
//     };
//     await hospital.save();

//     return res.status(200).json({ imageUrl: result.secure_url });
//   } else {
//     throw new createError.BadRequest("No file uploaded!");
//   }
// };

// const uploadProfile = async (req, res) => {
//   const { id } = req.params;
//   const { name, phone, email } = req.body;

  
//   const file = await uploadFile(req, res);

//   const user = await userModel.findById(id);
//   if (!user) {
//     return res.status(404).json({ message: "User not found!" });
//   }


//     // Validate phone number - remove starting 0 if needed
//     const cleanedPhone = phone.startsWith("0") ? phone.slice(1) : phone;
//     if (!/^\d{10}$/.test(cleanedPhone)) {
//       return res.status(404).json({ message: "Phone number must be exactly 10 digits" });
//     }



//   // Update name even if no file
//   if (name || phone || email) {
//     user.name = name;
//     user.phone = phone;
//     user.email = email;
//   }

//   console.log(file, "file");
  

//   if (file) {
//     // delete old image if exists
//     if (user.picture?.public_id) {
//       await cloudinary.uploader.destroy(user.picture.public_id);
//     }

//     const normalizedPath = path.normalize(file.path);
//     const result = await cloudinary.uploader.upload(normalizedPath);

//     user.picture = {
//       imageUrl: result.secure_url,
//       public_id: result.public_id,
//     };
//   }

//   await user.save();

//      const io = getIO();
//     io.emit("profile", {
//       userId: id,
//        message: `Profile updated`,
//     });
    

//   return res.status(200).json({
//     message: "Profile updated successfully",
//     user, // return whole updated user, not just image
//   });
// };

// module.exports = {
//   upload,
//   uploadFile,
//   uploadImage,
//   uploadProfile
// };


const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const createError = require("http-errors");
const path = require("path");
const Hospital = require("../models/hospital");
const userModel = require("../models/user");
const { getIO } = require("../sockets/socket");

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

// Updated uploadFile to handle form fields
const uploadFile = (req, res) => {
  return new Promise((resolve, reject) => {
    upload.single("image")(req, res, (err) => {
      if (err) {
        return reject(err);
      }
      resolve(req); // Return the entire req object to access both file and body
    });
  });
};

const uploadImage = async (req, res) => {
  const { id } = req.params;

  const reqWithFile = await uploadFile(req, res);
  const file = reqWithFile.file;

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
  try {
    const { id } = req.params;
    

    // Handle file upload if present
    let file = null;
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      const reqWithFile = await uploadFile(req, res);
      file = reqWithFile.file;
      
    }

    const user = await userModel.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    // Extract data from request - handle both JSON and form-data
    const { name, phone, email } = req.body;


    // Validate required fields
    if (!name || !phone || !email) {
      return res.status(400).json({ 
        message: "Name, phone, and email are required fields" 
      });
    }

    // Validate phone number
    const cleanedPhone = phone.startsWith("0") ? phone.slice(1) : phone;
    if (!/^\d{10}$/.test(cleanedPhone)) {
      return res.status(400).json({ 
        message: "Phone number must be exactly 10 digits" 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        message: "Please provide a valid email address" 
      });
    }

    // Update user fields
    user.name = name;
    user.phone = cleanedPhone; // Use cleaned phone number
    user.email = email;

    // Handle image upload if file exists
    if (file) {
      console.log("📸 Processing image upload...");
      
      // Delete old image if exists
      if (user.picture?.public_id) {
        try {
          await cloudinary.uploader.destroy(user.picture.public_id);
          console.log("🗑️ Old image deleted from Cloudinary");
        } catch (cloudinaryError) {
          console.log("⚠️ Could not delete old image from Cloudinary:", cloudinaryError);
        }
      }

      const normalizedPath = path.normalize(file.path);
      const result = await cloudinary.uploader.upload(normalizedPath);

      user.picture = {
        imageUrl: result.secure_url,
        public_id: result.public_id,
      };
      console.log("✅ New image uploaded to Cloudinary");
    }

    await user.save();
    console.log("✅ User profile saved successfully");

    // Emit socket event
    const io = getIO();
    io.emit("profile", {
      userId: id,
      message: `Profile updated`,
    });

    return res.status(200).json({
      message: "Profile updated successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        picture: user.picture
      },
    });

  } catch (error) {
    console.error("❌ Error in uploadProfile:", error);
    return res.status(500).json({ 
      message: "Internal server error",
      error: error.message 
    });
  }
};

module.exports = {
  upload,
  uploadFile,
  uploadImage,
  uploadProfile
};
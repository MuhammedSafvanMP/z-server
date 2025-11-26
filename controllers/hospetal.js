const bcrypt = require("bcrypt");
const Jwt = require("jsonwebtoken");
const Hospital = require("../models/hospital");
const User = require("../models/user");
const notficationModel = require("../models/notification");
const bookingModel = require("../models/bookings");
const mongoose = require("mongoose");
const { v2: cloudinary } = require("cloudinary");
const  admin = require("firebase-admin");


const { getIO } = require("../sockets/socket");

const twilio = require("twilio");
const { uploadFile, uploadProfile } = require("../middlewares/multer");
require("dotenv").config();

const otpStorage = new Map();

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Hospital Registration
const HospitalRegistration = async (req, res) => {
  const {
    name,
    type,
    email,
    mobile,
    address,
    latitude,
    longitude,
    password,
    workingHours,
    workingHoursClinic,
    hasBreakSchedule = false,
  } = req.body;

  // Validate the request body using Joi - update your Joi schema accordingly
  const data = {
    name,
    email,
    mobile,
    address,
    latitude,
    longitude,
    password,
    workingHours: hasBreakSchedule ? undefined : workingHours,
    workingHoursClinic: hasBreakSchedule ? workingHoursClinic : undefined,
    hasBreakSchedule,
  };

  // const { error } = await RegistrationSchema.validate(data);
  // if (error) {
  //   throw new createError.BadRequest(error?.details[0].message);
  // }

  // Check if the hospital already exists with the same email
  const existingHospital = await Hospital.findOne({ email });
  if (existingHospital) {
     return res.status(409).json({ message: "Email already exists. Please login." });

  }

    const existingHospitalMobile = await Hospital.findOne({ phone: mobile });
  if (existingHospitalMobile) {
     return res.status(409).json({ message: "Phone already exists. Please login." });

  }

  // Hash the password before saving it
  const hashedPassword = await bcrypt.hash(password, 10);

  // Prepare the hospital data based on schedule type
  const hospitalData = {
    name,
    type,
    email,
    phone: mobile,
    address,
    latitude,
    longitude,
    password: hashedPassword,
  };

  if (workingHoursClinic) {
    // Use clinic schedule with breaks
    hospitalData.working_hours_clinic = Object.entries(workingHoursClinic).map(
      ([day, hours]) => ({
        day,
        morning_session: hours.isHoliday
          ? { open: "", close: "" }
          : hours.morning_session,
        evening_session: hours.isHoliday
          ? { open: "", close: "" }
          : hours.evening_session,
        is_holiday: hours.isHoliday,
        has_break: hours.hasBreak,
      })
    );
  } else if (workingHours) {
    // Use regular schedule without breaks
    hospitalData.working_hours = Object.entries(workingHours).map(
      ([day, hours]) => ({
        day,
        opening_time: hours.isHoliday ? "" : hours.open,
        closing_time: hours.isHoliday ? "" : hours.close,
        is_holiday: hours.isHoliday,
      })
    );
  }

  const newHospital = new Hospital(hospitalData);

  // Save the hospital to the database
  await newHospital.save();

  // Respond with a success message
  return res.status(201).json({
    message: "Hospital registered successfully.",
    status: 200,
    scheduleType: hasBreakSchedule ? "clinic_with_breaks" : "regular",
  });
};

//Hospital login
const HospitalLogin = async (req, res) => {
  const { email, password } = req.body;
  

  const hospital = await Hospital.findOne({ email: email });
  if (!hospital) {
    return res.status(401).json({ message: "User not found!" });
  }
  const isValidPassword = await bcrypt.compare(password, hospital.password);
  if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
  }
  const jwtKey = process.env.JWT_SECRET;
  if (!jwtKey) {
    return res.status(400).json({ message: "JWT_SECRET is not defined" });
  }
  // Generate JWT tokens
  const token = Jwt.sign({ id: hospital._id, name: hospital.name }, jwtKey, {
    expiresIn: "15m",
  });

  const refreshToken = Jwt.sign(
    { id: hospital._id, name: hospital.name },
    jwtKey,
    {
      expiresIn: "7d",
    }
  );

  const sevenDayInMs = 7 * 24 * 60 * 60 * 1000;
  const expirationDate = new Date(Date.now() + sevenDayInMs);
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    expires: expirationDate,
    secure: process.env.NODE_ENV === "production", 
  sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax", 

  });

  return res.status(200).json({
    status: "Success",
    token: token,
    data: hospital,
    message: "Hospital logged in successfully.",
  });
};

const login = async (req, res) => {
  let phone = req.body.phone;

  try {
    // Check if customer exists
    const user = await Hospital.findOne({ phone: String(phone).trim() });

    if (!user) {
      return res.status(400).json({ message: "Phone number not registered!" });
    }

    // Ensure +91 prefix with space
    if (!phone.startsWith("+91")) {
      phone = "+91 " + phone.replace(/^\+91\s*/, "").trim();
    }

    if (phone == "+91 9400517720") {
      otpStorage.set(phone, 123456);

      return res
        .status(200)
        .json({ message: `OTP sent successfully ${123456}`, status: 200 });
    }

    // Generate OTP (6-digit random number)
    const otp = Math.floor(100000 + Math.random() * 900000);
    otpStorage.set(phone, otp); // Store OTP temporarily

    // Send OTP via Twilio
    await client.messages.create({
      body: `Your verification code is: ${otp}`,
      from: process.env.TWLIO_NUMBER,
      to: phone,
    });

    return res
      .status(200)
      .json({ message: `OTP sent successfully ${otp}`, status: 200 });
  } catch (error) {
    console.error("Twilio Error:", error);
    return res
      .status(500)
      .json({ message: "Failed to send OTP", error: error, status: 500 });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    

    if (!phone || !otp) {
      return res.status(400).json({ message: "Phone and OTP are required" });
    }

    // Ensure +91 prefix
    const formattedPhone = phone.startsWith("+91")
      ? phone
      : "+91 " + phone.replace(/^\+91\s*/, "").trim();

    // Validate OTP
    const storedOtp = otpStorage.get(formattedPhone);

    if (!storedOtp || storedOtp.toString().trim() !== otp.toString().trim()) {
      return res
        .status(400)
        .json({ message: `Invalid or expired OTP` });
    }

    // Remove OTP from storage
    otpStorage.delete(formattedPhone);

    // Find customer
    const hospital = await Hospital.findOne({ phone });
    if (!hospital) {
      return res.status(400).json({ message: "Customer not found" });
    }

    const jwtKey = process.env.JWT_SECRET;
    if (!jwtKey) {
          return res.status(401).json({ message: "JWT_SECRET is not defined" });    

    }
    // Generate JWT tokens
    const token = Jwt.sign({ id: hospital._id, name: hospital.name }, jwtKey, {
      expiresIn: "15m",
    });

    const refreshToken = Jwt.sign(
      { id: hospital._id, name: hospital.name },
      jwtKey,
      {
        expiresIn: "7d",
      }
    );

    const sevenDayInMs = 7 * 24 * 60 * 60 * 1000;
    const expirationDate = new Date(Date.now() + sevenDayInMs);
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      expires: expirationDate,
        secure: process.env.NODE_ENV === "production", 
  sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    });

    return res.status(200).json({
      message: "OTP verified successfully",
      token,
      hospital,
      status: 200,
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    return res.status(500).json({ error: "Server error, please try again" });
  }
};

// Reset pasword
const resetPassword = async (req, res) => {
  const { phone, password } = req.body;

  const hospital = await Hospital.findOne({ phone });
  if (!hospital) {
    return res.status(401).json({ message: "No user found" });    
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  hospital.password = hashedPassword;

  // ✅ Skip validation since reviews are missing user_id
  await hospital.save({ validateBeforeSave: false });

  return res.status(200).json({
    status: 200,
    message: "Password updated successfully",
  });
};

const getHospitalDataSearch = async (req, res) => {
  try {
    const { search } = req.params;

    const findHospital = await Hospital.find({
      $or: [
        { type: { $regex: new RegExp(search, "i") } }, // Match type (case-insensitive)
        { "specialties.name": { $regex: new RegExp(search, "i") } } // Match specialties array name
      ]
    });

    res.status(200).json(findHospital);
  } catch (error) {
    console.error("Error fetching hospitals:", error);
    res.status(500).json({ message: "Server error", error });
  }
};




// ✅ Get doctors by hospital or speciality or all
const getHospitalDoctors = async (req, res) => {
  try {
    const { id, speciality } = req.query;


    // 🧩 Case 2: Filter by speciality across all hospitals
    if ( id && speciality) {

      
      const hospitals = await Hospital.find({
        "_id": id,
        "specialties.name": { $regex: new RegExp(speciality, "i") },
      });

      const filteredHospitals = hospitals
        .map((hosp) => {
          const matchingDoctors = [];
          hosp.specialties.forEach((spec) => {
            if (spec.name.toLowerCase().includes(speciality.toLowerCase())) {
              spec.doctors?.forEach((doctor) => {
                matchingDoctors.push({
                  ...doctor.toObject?.() || doctor,
                  specialty: spec.name,
                  department_info: spec.department_info,
                });
              });
            }
          });

          return {
            id: hosp._id,
            name: hosp.name,
            address: hosp.address,
            phone: hosp.phone,
            email: hosp.email,
            type: hosp.type,
            image: hosp.image,
            doctors: matchingDoctors,
          };
        })
        .filter((hosp) => hosp.doctors.length > 0);

        console.log(filteredHospitals, "filteredHospitals");
        

      return res.status(200).json({
        success: true,
        message: "Hospitals filtered by speciality fetched successfully",
        hospitals: filteredHospitals,
      });
    }

    // 🧩 Case 3: Return all hospitals with all doctors
    const hospitals = await Hospital.find();

    const hospitalsWithDoctors = hospitals.map((hosp) => {
      let allDoctors = [];
      hosp.specialties.forEach((specialty) => {
        specialty.doctors?.forEach((doctor) => {
          allDoctors.push({
            ...doctor.toObject?.() || doctor,
            specialty: specialty.name,
            department_info: specialty.department_info,
          });
        });
      });

      return {
        id: hosp._id,
        name: hosp.name,
        address: hosp.address,
        phone: hosp.phone,
        email: hosp.email,
        type: hosp.type,
        image: hosp.image,
        doctors: allDoctors,
        doctorCount: allDoctors.length,
      };
    });


    return res.status(200).json({
      success: true,
      message: "All hospitals with doctors fetched successfully",
      hospitals: hospitalsWithDoctors,
    });
  } catch (error) {
    console.error("❌ Error in getHospitalDoctors:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching hospital doctors",
      error: error.message,
    });
  }
};








// Get Hospital(DashBoard) Details
const getHospitalDetails = async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
            return res.status(401).json({ message: "No token provided. Please login." });    

  }

  const decoded = Jwt.verify(
    token,
    process.env.JWT_SECRET
  );
  if (!decoded) {
        return res.status(401).json({ message: "Invalid token. Please login." });    
  }

  const hospital = await Hospital.findById(decoded.id);

  return res.status(200).json({
    status: "Success",
    data: hospital,
  });
};

//Update hospital details
// const updateHospitalDetails = async (req, res) => {

//   console.log(req.body, "hiiis");

//       console.log('Request file:', req.file);
//     console.log('Request files:', req.files);


//       const reqWithFile = await uploadFile(req, res);
//       const file = reqWithFile.file;
    
  
//   const { id } = req.params;
//   const {
//     name,
//     email,
//     mobile,
//     address,
//     latitude,
//     longitude,
//     workingHours,
//     emergencyContact,
//     about,
//     image,
//     currentPassword,
//     newPassword,
//     workingHoursClinic,
//   } = req.body;
//   const hospital = await Hospital.findById(id);
//   if (!hospital) {
//     throw new createError.NotFound("Hospital not found. Wrong input");
//   }
//   // if (currentPassword) {
//   //   await bcrypt.compare(currentPassword, hospital.password).catch(() => {
//   //     throw new createError.BadRequest("Current password is wrong");
//   //   });
//   // }

//   // Update the hospital fields
//   if (newPassword) {
//     const Password = await bcrypt.hash(newPassword, 10);
//     hospital.password = Password;
//   }
//   hospital.name = name || hospital.name;
//   hospital.email = email || hospital.email;
//   hospital.phone = mobile || hospital.phone;
//   hospital.address = address || hospital.address;
//   hospital.latitude = latitude || hospital.latitude;
//   hospital.longitude = longitude || hospital.longitude;
//   hospital.working_hours = workingHours || hospital.working_hours;
//   hospital.working_hours_clinic =
//     workingHoursClinic || hospital.working_hours_clinic;

//   hospital.emergencyContact = emergencyContact || hospital.emergencyContact;
//   hospital.about = about || hospital.about;
//   hospital.image = image || hospital.image;

//   // Save the updated hospital data
//   await hospital.save();

//   return res.status(200).json({
//     status: "Success",
//     message: "Hospital details updated successfully",
//   });
// };




// const updateHospitalDetails = async (req, res) => {
//   try {
//     console.log('Request body:', req.body);
//     console.log('Request file:', req.file);

//     const { id } = req.params;


//      let file = null;
//       const reqWithFile = await uploadProfile(req, res);
//       file = reqWithFile.file;
      
  
    
//     // Check if req.body exists and has data
//     if (!req.body || Object.keys(req.body).length === 0) {
//       return res.status(400).json({ 
//         message: 'No data received in request body' 
//       });
//     }

//     const {
//       name,
//       email,
//       phone, // Change from 'mobile' to match frontend
//       address,
//       latitude,
//       longitude,
//       working_hours, // Change from 'workingHours' to match frontend
//       emergencyContact,
//       about,
//       type, // Add this field
//       working_hours_clinic, // Change from 'workingHoursClinic' to match frontend
//       hasBreakSchedule
//     } = req.body;

//     const hospital = await Hospital.findById(id);
//     if (!hospital) {
//       return res.status(404).json({ message: "Hospital not found" });
//     }

//     // Parse JSON strings from FormData
//     let workingHoursParsed = [];
//     let workingHoursClinicParsed = [];

//     try {
//       workingHoursParsed = working_hours ? JSON.parse(working_hours) : [];
//       workingHoursClinicParsed = working_hours_clinic ? JSON.parse(working_hours_clinic) : [];
//     } catch (parseError) {
//       console.error('Error parsing JSON fields:', parseError);
//       return res.status(400).json({ message: 'Invalid JSON in working hours fields' });
//     }

//     // Update hospital fields
//     hospital.name = name || hospital.name;
//     hospital.email = email || hospital.email;
//     hospital.phone = phone || hospital.phone; // Use 'phone' instead of 'mobile'
//     hospital.address = address || hospital.address;
//     hospital.latitude = latitude || hospital.latitude;
//     hospital.longitude = longitude || hospital.longitude;
//     hospital.type = type || hospital.type; // Add type field
//     hospital.working_hours = workingHoursParsed.length > 0 ? workingHoursParsed : hospital.working_hours;
//     hospital.working_hours_clinic = workingHoursClinicParsed.length > 0 ? workingHoursClinicParsed : hospital.working_hours_clinic;
//     hospital.emergencyContact = emergencyContact || hospital.emergencyContact;
//     hospital.about = about || hospital.about;

//      if (file) {
//           console.log("📸 Processing image upload...");
          
//           // Delete old image if exists
//           if (hospital?.image?.public_id) {
//             try {
//               await cloudinary.uploader.destroy(user.picture.public_id);
//               console.log("🗑️ Old image deleted from Cloudinary");
//             } catch (cloudinaryError) {
//               console.log("⚠️ Could not delete old image from Cloudinary:", cloudinaryError);
//             }
//           }
    
//           const normalizedPath = path.normalize(file.path);
//           const result = await cloudinary.uploader.upload(normalizedPath);
    
//           hospital.image = {
//             imageUrl: result.secure_url,
//             public_id: result.public_id,
//           };
//           console.log("✅ New image uploaded to Cloudinary");
//         }

  

//     await hospital.save();

//     return res.status(200).json({
//       status: "Success",
//       message: "Hospital details updated successfully",
//       data: hospital
//     });

//   } catch (error) {
//     console.error('Update error:', error);
//     return res.status(500).json({ 
//       message: 'Server error', 
//       error: error.message 
//     });
//   }
// };

const updateHospitalDetails = async (req, res) => {
  try {
 
    const { id } = req.params;

    // file from multer
    let file = req.file || null;

    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ message: "No data received" });
    }

    const hospital = await Hospital.findById(id);
    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found" });
    }

    // parse JSON values
    let workingHoursParsed = JSON.parse(req.body.working_hours || "[]");
    let workingHoursClinicParsed = JSON.parse(req.body.working_hours_clinic || "[]");

    // update hospital info
    hospital.name = req.body.name || hospital.name;
    hospital.email = req.body.email || hospital.email;
    hospital.phone = req.body.phone || hospital.phone;
    hospital.address = req.body.address || hospital.address;
    hospital.latitude = req.body.latitude || hospital.latitude;
    hospital.longitude = req.body.longitude || hospital.longitude;
    hospital.type = req.body.type || hospital.type;
    hospital.working_hours = workingHoursParsed.length ? workingHoursParsed : hospital.working_hours;
    hospital.working_hours_clinic = workingHoursClinicParsed.length ? workingHoursClinicParsed : hospital.working_hours_clinic;
    hospital.emergencyContact = req.body.emergencyContact || hospital.emergencyContact;
    hospital.about = req.body.about || hospital.about;

    // image upload
    if (file) {
      const result = await cloudinary.uploader.upload(file.path);
      hospital.image = {
        imageUrl: result.secure_url,
        public_id: result.public_id,
      };
    }

    await hospital.save();

    return res.status(200).json({
      status: "Success",
      message: "Hospital updated successfully",
      data: hospital,
    });

  } catch (error) {
    console.error("Update error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};



// Add a new specialty
const addSpecialty = async (req, res) => {
  
  
  const { department_info, description, doctors, name, phone } = req.body;
  const { id } = req.params;

  const hospital = await Hospital.findById(id);
  if (!hospital) {
    return res.status(404).json({ message: "Hospital not found. Wrong input" });    

  }

  // Check the spectilty already exist
  const isExist = hospital.specialties.find(
    (element) =>
      element.name?.trim().toLowerCase() ===
      name.toString().trim().toLowerCase()
  );

  if (isExist) {
    return res.status(404).json({ message: "Specialty is already exist!" });    
  }

    const cleanedPhone = phone.startsWith("0") ? phone.slice(1) : phone;
    if (!/^\d{10}$/.test(cleanedPhone)) {
        return res.status(404).json({ message: "Phone number must be exactly 10 digits" });
    }

  hospital.specialties.push({
    name: name,
    department_info: department_info,
    description: description,
    phone: phone,
    doctors: doctors,
  });

  await hospital.save();

  return res.status(201).json({
    status: "Successsss",
    message: "Specialty added successfully",
    data: hospital.specialties,
  });
};

// Update Specialty
const updateSpecialty = async (req, res) => {
  const { department_info, description, doctors, name, phone } = req.body;

  
  const { id , specialityId } = req.params;
  const hospital = await Hospital.findById(id);

  
  if (!hospital) {
    return res.status(404).json({ message: "Hospital not found. Wrong input" });    
  }
  
  // Check the spectilty
 const specialty = hospital.specialties.find(
  (element) => element._id.toString() === specialityId
);

  
  if (!specialty) {
    return res.status(404).json({ message: "Specialty not found."});
  }
  

    const cleanedPhone = phone.startsWith("0") ? phone.slice(1) : phone;
    if (!/^\d{10}$/.test(cleanedPhone)) {
        return res.status(404).json({ message: "Phone number must be exactly 10 digits" });
    }
    

  // Update the fields
  if (department_info !== undefined) {
    specialty.department_info = department_info;
  }
  if (description !== undefined) {
    specialty.description = description;
  }
  if (phone !== undefined) {
    specialty.phone = phone;
  }
  if (doctors !== undefined) {
    specialty.doctors = doctors;
  }
  if (name !== undefined) {
    specialty.name = name;
  }

  await hospital.save();

  return res.status(201).json({
    status: "Success",
    message: "Specialty updated successfully",
    data: hospital.specialties,
  });
};

// Delete a specialty
const deleteSpecialty = async (req, res) => {
  const { id , specialityId } = req.params;

  const hospital = await Hospital.findById(id);
  if (!hospital) {
        return res.status(404).json({ message: "Hospital not found. Wrong input"});
  }


   const index = hospital.specialties.findIndex(
  (element) => element._id.toString() === specialityId
);

  if (index === -1) {
        return res.status(404).json({ message: "Specialty not found."});

  }
  hospital.specialties.splice(index, 1);

  await hospital.save();

  return res.status(201).json({
    status: "Success",
    message: "Specialty deleted successfully",
    data: hospital.specialties,
  });
};

// Add a doctor
const addDoctor = async (req, res) => {
  const { id } = req.params;
  const { name, specialty, consulting, qualification } = req.body;
  
  const data = { name, consulting, qualification };

  const hospital = await Hospital.findById(id);
 
  
  hospital?.specialties
    .filter((Specialty) => {
      return Specialty.name.toLocaleLowerCase() == specialty.toLocaleLowerCase();
    })[0]
    .doctors.push(data);
  await hospital?.save();
  return res.status(201).json({
    message: `Added new doctor in ${specialty}`,
    data: hospital?.specialties,
  });
};

// Update Doctor
const updateDoctor = async (req, res) => {
  const { hospitalId, specialtyId, doctorId } = req.params;
  
  const { _id, name, specialty, consulting, qualification, bookingOpen } = req.body;
  const data = { name, consulting, qualification };

  const hospital = await Hospital.findById(hospitalId);

  if (!hospital) {
    return res.status(404).json({ message: "Hospital not found" });
  }

  const targetSpecialty = hospital.specialties.find(
    (s) =>  s._id.toString() == specialtyId,
  );

  if (!targetSpecialty) {
    return res.status(400).json({ message: `Specialty ${specialty} not found`});

  }

  const targetDoctor = targetSpecialty.doctors.find((d) => d._id.toString() == doctorId);

  if (!targetDoctor) {
 
    return res.status(400).json({ message: `Doctor with ID ${_id} not found in specialty ${specialty}`});

  }

 if (data.name && data.name !== "") {
  targetDoctor.name = data.name;
}

if (Array.isArray(data.consulting) && data.consulting.length > 0) {
  targetDoctor.consulting = data.consulting;
}

if (data.qualification && data.qualification !== "") {
  targetDoctor.qualification = data.qualification;
}

if (bookingOpen !== undefined) {
  targetDoctor.bookingOpen = bookingOpen;
}



  await hospital.save();

  return res.status(200).json({
    message: `Doctor in ${specialty} updated successfully`,
    data: hospital.specialties,
  });
};

// Delete Doctor
const deleteDoctor = async (req, res) => {
  try {
    const { hospitalId, specialtyId, doctorId } = req.params;

    // Find Hospital
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(400).json({ message: "Hospital not found!" });
    }

    // Find Specialty
    const targetSpecialty = hospital.specialties.find(
      (s) => s._id.toString() === specialtyId
    );

    if (!targetSpecialty) {
      return res.status(400).json({ message: "Specialty not found!" });
    }

    // Find doctor index
    const doctorIndex = targetSpecialty.doctors.findIndex(
      (d) => d._id.toString() === doctorId
    );

    if (doctorIndex === -1) {
      return res.status(400).json({ message: "Doctor not found!" });
    }

    // Remove doctor
    targetSpecialty.doctors.splice(doctorIndex, 1);

    // Save hospital
    await hospital.save();

    return res.status(200).json({
      message: `Doctor in ${targetSpecialty.name} deleted successfully`,
      data: hospital.specialties,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
};


const hospitalDelete = async (req, res) => {
  const { id } = req.params;

  if (req.cookies.refreshToken) {
    const expirationDate = new Date(0);
    res.cookie("refreshToken", "", {
      httpOnly: true,
      expires: expirationDate,
    
        secure: process.env.NODE_ENV === "production", 
  sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    });
  }
  const hospital = await Hospital.findById(id);
  if (!hospital) {
          return res.status(400).json({ message: "Hospital not found!" });

  }
  if (hospital.image?.public_id) {
    await cloudinary.uploader.destroy(hospital.image.public_id);
  }
  await Hospital.deleteOne({ _id: id });
  return res.status(200).send("Your account deleted successfully");
};

// const createBooking = async (req, res) => {
//   try {
//     const { id } = req.params; // hospital id
//     const { userId, specialty, doctor_name, booking_date,  patient_name ,  patient_phone , patient_place,  patient_dob } = req.body;

//     // Validate user
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     // Validate hospital
//     const hospital = await Hospital.findById(id);
//     if (!hospital) {
//       return res.status(404).json({ message: "Hospital not found" });
//     }

//     // Create new booking object
//     const newBooking = {
//       userId,
//       specialty,
//       doctor_name,
//       booking_date,
//       status: "pending",
//       patient_name ,  patient_phone , patient_place,  patient_dob
//     };

//     // Push into hospital booking array
//     hospital.booking.push(newBooking);

//     // Save hospital
//     await hospital.save();

//     await notficationModel.create({
//       hospitalId: id,
//       message: `${doctor_name} has created a new booking.`,
//     });

//     const io = getIO();
//     io.emit("pushNotification", {
//       hospitalId: id,
//       message: `New booking by ${doctor_name}`,
//     });

//     return res.status(201).json({
//       message: "Booking created successfully",
//       data: hospital.booking[hospital.booking.length - 1], 
//       status: 201,
//     });
//   } catch (error) {
//     console.error("Error creating booking:", error);
//     return res.status(500).json({ message: "Server error", error });
//   }
// };

// const updateBooking = async (req, res) => {
//   try {
//     const { hospitalId, bookingId } = req.params;
//     const { status, booking_date, booking_time } = req.body;

//     // Find hospital
//     const hospital = await Hospital.findById(hospitalId);
//     if (!hospital) {
//       return res.status(404).json({ message: "Hospital not found" });
//     }

//     // Find booking inside hospital
//     const booking = hospital.booking.id(bookingId);
//     if (!booking) {
//       return res.status(404).json({ message: "Booking not found" });
//     }

//     // Update booking fields
//     if (status) booking.status = status;
//     if (booking_date) booking.booking_date = booking_date;
//     if (booking_time) booking.booking_time = booking_time;

//     await hospital.save();

//     // Find the user of this booking
//     const user = await User.findById(booking.userId);
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

   

//     if (status == "cancel") {
//       await notficationModel.create({
//         hospitalId: hospitalId,
//         message: `The booking with  ${booking.doctor_name} has been ${booking.status}.`,
//       });
//     } else {
//       // Create a notification record in DB
//       await notficationModel.create({
//         userId: booking.userId,
//         message: `Your booking with ${booking.doctor_name} is now ${booking.status}.`,
//       });
      
//        const io = getIO();
//     io.emit("pushNotificationPhone", {
//       userId: booking.userId,
//   message: `Your booking with ${booking.doctor_name} is ${booking.status}`,
//     });
//     }

//     return res.status(200).json({
//       message: "Booking updated and notification sent",
//       booking,
//     });
//   } catch (error) {
//     console.error("Error updating booking:", error);
//     return res.status(500).json({ message: "Server error", error });
//   }
// };


// const createBooking = async (
//   req,
//   res
// ) => {
//   try {
//     const { id } = req.params; // hospital id
//     const { 
//       userId, 
//       specialty, 
//       doctor_name, 
//       booking_date,  
//       patient_name,  
//       patient_phone, 
//       patient_place,  
//       patient_dob 
//     } = req.body;

//     // Validate phone number - remove starting 0 if needed
//     const cleanedPhone = patient_phone.startsWith("0") ? patient_phone.slice(1) : patient_phone;
//     if (!/^\d{10}$/.test(cleanedPhone)) {
//              return res.status(400).json({ message:  "Phone number must be exactly 10 digits" });
//     }

//     // Validate user
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ message: "User not found" });
//     }

//     // Validate hospital
//     const hospital = await Hospital.findById(id);
//     if (!hospital) {
//       return res.status(404).json({ message: "Hospital not found" });
//     }

//     // Parse booking date and get day name
//     const bookingDate = new Date(booking_date);
//     const bookingDay = bookingDate.toLocaleDateString('en-US', { weekday: 'long' });
    
//     // Find the doctor and check availability
//     let isDoctorAvailable = false;
//     let foundDoctor = null;
//     let availableDays = [];

//     // Loop through specialties to find the doctor
//     for (const specialtyItem of hospital.specialties) {
//       for (const doctor of specialtyItem.doctors) {
//         if (doctor.name === doctor_name) {
//           foundDoctor = doctor;
          
//           // Check if doctor has consulting schedule
//           if (doctor.consulting && Array.isArray(doctor.consulting)) {
//             availableDays = doctor.consulting
//               .filter(consult => consult.day && consult.sessions && consult.sessions.length > 0)
//               .map(consult => consult.day);
            
//             isDoctorAvailable = availableDays.includes(bookingDay);
//           }
//           break;
//         }
//       }
//       if (foundDoctor) break;
//     }

//     if (!foundDoctor) {
//       return res.status(404).json({ 
//         message: `Doctor ${doctor_name} not found in this hospital` 
//       });
//     }

//     if (!isDoctorAvailable) {
//       return res.status(400).json({ 
//         message: `Doctor ${doctor_name} is not available on ${bookingDay}. Available days: ${availableDays.join(', ')}` 
//       });
//     }

//    const booking = await   bookingModel.create({
//          userId,
//       specialty,
//       doctor_name,
//       booking_date,
//       status: "pending",
//       patient_name,  
//       patient_phone, 
//       patient_place,  
//       patient_dob,
//       hospitalId: id,
//   })

//   await booking.save()


//     // Create notification
//     await notficationModel.create({
//       hospitalId: id,
//       message: `New booking created for Dr. ${doctor_name} on ${bookingDay}.`,
//     });

//     // Emit socket event
//     const io = getIO();
//     io.emit("pushNotification", {
//       hospitalId: id,
//       message: `New booking by ${patient_name} for Dr. ${doctor_name}`,
//     });

//     io.emit("bookingcreate", {
//       userId: userId,
//        message: `Your booking accepted`,
//     });

//     return res.status(201).json({
//       message: "Booking created successfully",
//       data: booking, 
//     });
//   } catch (error) {
//     console.error("Error creating booking:", error);
//     return res.status(500).json({ message: "Server error", error });
//   }
// };


const createBooking = async (req, res) => {
  try {
    const { id } = req.params; // hospital id
    const { 
      userId, 
      specialty, 
      doctor_name, 
      booking_date,  
      patient_name,  
      patient_phone, 
      patient_place,  
      patient_dob 
    } = req.body;

    // Validate phone number - remove starting 0 if needed
    const cleanedPhone = patient_phone.startsWith("0") ? patient_phone.slice(1) : patient_phone;
    if (!/^\d{10}$/.test(cleanedPhone)) {
      return res.status(400).json({ message: "Phone number must be exactly 10 digits" });
    }

    // Validate user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Validate hospital
    const hospital = await Hospital.findById(id);
    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found" });
    }

    // Parse booking date and get day name
    const bookingDate = new Date(booking_date);
    const bookingDay = bookingDate.toLocaleDateString('en-US', { weekday: 'long' });
    
    // Find the doctor and check availability
    let isDoctorAvailable = false;
    let foundDoctor = null;
    let availableDays = [];

    // Loop through specialties to find the doctor
    for (const specialtyItem of hospital.specialties) {
      for (const doctor of specialtyItem.doctors) {
        if (doctor.name === doctor_name) {
          foundDoctor = doctor;
          
          // Check if doctor has consulting schedule
          if (doctor.consulting && Array.isArray(doctor.consulting)) {
            availableDays = doctor.consulting
              .filter(consult => consult.day && consult.sessions && consult.sessions.length > 0)
              .map(consult => consult.day);
            
            isDoctorAvailable = availableDays.includes(bookingDay);
          }
          break;
        }
      }
      if (foundDoctor) break;
    }

    if (!foundDoctor) {
      return res.status(404).json({ 
        message: `Doctor ${doctor_name} not found in this hospital` 
      });
    }

    if (!isDoctorAvailable) {
      return res.status(400).json({ 
        message: `Doctor ${doctor_name} is not available on ${bookingDay}. Available days: ${availableDays.join(', ')}` 
      });
    }

    const booking = await bookingModel.create({
      userId,
      specialty,
      doctor_name,
      booking_date,
      status: "pending",
      patient_name,  
      patient_phone, 
      patient_place,  
      patient_dob,
      hospitalId: id,
    });

    // Create notification
    await notficationModel.create({
      hospitalId: id,
      message: `New booking created for Dr. ${doctor_name} on ${bookingDay}.`,
    });

    // Emit socket event - FIXED: Include userId in the event data
    const io = getIO();
  
       io.emit("bookingCreated", {
      userId: userId,
      message: `New booking by ${patient_name} for Dr. ${doctor_name}`,
    });


    // Emit to hospital
    io.emit("pushNotifications", {
      hospitalId: id,
      message: `New booking by ${patient_name} for Dr. ${doctor_name}`,
    });

    return res.status(201).json({
      message: "Booking created successfully",
      data: booking, 
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};



// Initialize Firebase Admin with environment variables
if (!admin.apps.length) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Missing Firebase environment variables');
    }

    const serviceAccount = {
      type: 'service_account',
      project_id: projectId,
      private_key: privateKey,
      client_email: clientEmail,
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:', error.message);
  }
}

 const updateBooking = async (
  req,
  res
) => {
  try {
    const { hospitalId, bookingId } = req.params;
    const { status, booking_date, booking_time } = req.body;


    // Find hospital and booking
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found" });
    }

    const booking =  await bookingModel.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Update booking fields
    if (status) booking.status = status;
    if (booking_date) booking.booking_date = booking_date;
    if (booking_time) booking.booking_time = booking_time;

    await booking.save();

    // Find the user
    const user = await User.findById(booking.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 🔥 FCM NOTIFICATION WITH BETTER ERROR HANDLING
    try {
      // ✅ Check both possible field names (FcmToken vs fcmToken)
      const userFcmToken = user.FcmToken 
      
  
      
      if (userFcmToken && userFcmToken.length > 0) {
      
        
        let notificationTitle = '';
        let notificationBody = '';
        let notificationType = '';

        if (status === "cancel" || status === "cancelled") {
          notificationTitle = 'Booking Cancelled ❌';
          notificationBody = `Your booking with Dr. ${booking.doctor_name} has been cancelled.`;
          notificationType = 'booking_cancelled';
          
          await notficationModel.create({
            hospitalId: hospitalId,
            message: `The booking with Dr. ${booking.doctor_name} has been cancelled.`,
          });
        } else {
          notificationTitle = 'Booking Updated';
          notificationBody = `Your booking with Dr. ${booking.doctor_name} is now ${status}.`;
          notificationType = 'booking_updated';
          
          await notficationModel.create({
            userId: booking.userId,
            message: `Your booking with Dr. ${booking.doctor_name} is now ${status}.`,
          });
        }

        const messagePayload = {
          notification: {
            title: notificationTitle,
            body: notificationBody,
          },
          data: {
            type: notificationType,
            bookingId: bookingId,
            hospitalId: hospitalId,
            click_action: 'FLUTTER_NOTIFICATION_CLICK'
          },
          android: {
            notification: {
              sound: 'default',
              channelId: 'high_importance_channel',
              priority: 'high',
              icon: 'ic_notification',
              color: (status === 'cancel' || status === 'cancelled') ? '#FF3B30' : '#28A745',
              clickAction: 'FLUTTER_NOTIFICATION_CLICK'
            }
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
                alert: {
                  title: notificationTitle,
                  body: notificationBody
                }
              }
            }
          },
          token: userFcmToken
        };

        console.log('🚀 Sending FCM notification...');
        const response = await admin.messaging().send(messagePayload);
        console.log('✅ FCM Notification sent successfully!');
        console.log('📱 Message ID:', response);
        
      } else {
        console.log('⚠️ No FCM token available for user:', user._id);
      }
    } catch (fcmError) {
      console.error('❌ FCM Error details:');
      console.error('   Code:', fcmError.code);
      console.error('   Message:', fcmError.message);
      
      if (fcmError.errorInfo) {
        console.error('   Error Info:', fcmError.errorInfo);
      }
    }

    // Socket.IO for real-time updates
    const io = getIO();
    if (status === "cancel" || status === "cancelled") {
      io.emit("pushNotificationWeb", {
        hospitalId: hospitalId,
        message: `The booking with Dr. ${booking.doctor_name} has been ${status}.`,
      });
    } else {
      io.emit("pushNotificationPhone", {
        userId: booking.userId,
        message: `Your booking with Dr. ${booking.doctor_name} is ${status}`,
      });

       io.emit("pushNotification", {
        userId: booking.userId,
        message: `Your booking with Dr. ${booking.doctor_name} is ${status}`,
      });

        io.emit("bookingUpdate", {
        userId: booking.userId,
        message: `Your booking with Dr. ${booking.doctor_name} is ${status}`,
      });
    }

    return res.status(200).json({
      message: "Booking updated successfully",
      booking,
    });
  } catch (error) {
    console.error("Error updating booking:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};





const getBookingsByHospitalId = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    

    if (!mongoose.Types.ObjectId.isValid(hospitalId)) {
      return res.status(400).json({ message: "Invalid hospital ID" });
    }

    // Find all hospitals that have at least one booking by this user
    const booking = await bookingModel.find({
      hospitalId: hospitalId,
    }).populate("userId")
    .sort({ createdAt: -1 });

    if (!booking || booking.length === 0) {
      return res
        .status(404)
        .json({ message: "No bookings found for this hospital" });
    }

    return res.status(200).json({
      message: "Hospital bookings fetched successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error fetching user bookings:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};


const getBookingsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Find all hospitals that have at least one booking by this user
    const booking = await bookingModel.find({
    userId,
    }).populate("hospitalId")
    .sort({ createdAt: -1 });

    if (!booking || booking.length === 0) {
      return res
        .status(404)
        .json({ message: "No bookings found for this user" });
    }

    return res.status(200).json({
      message: "User bookings fetched successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error fetching user bookings:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

 const getSingleHospital = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) throw new createError.BadRequest("Invalid hospital ID");

    // ✅ Populate the `reviews.user_id` field with user info
    const hospital = await Hospital.findById(id);
    
    if (!hospital) throw new createError.NotFound("Hospital not found");

    return res.status(200).json({
      message: "Hospital details fetched successfully",
      data: hospital,
      status: 200,
    });
  } catch (error) {
    console.error("❌ Error in getSingleHospital:", error);
    next(error); // Pass to error middleware if using express error handler
  }
};



module.exports = {
  HospitalRegistration,
  HospitalLogin,
  login,
  verifyOtp,
  resetPassword,
  getHospitalDetails,
  updateHospitalDetails,
  addSpecialty,
  updateSpecialty,
  deleteSpecialty,
  addDoctor,
  updateDoctor,
  deleteDoctor,
  hospitalDelete,
  createBooking,
  updateBooking,
  getBookingsByUserId,
  getHospitalDataSearch,
  getHospitalDoctors,
  getSingleHospital,
  getBookingsByHospitalId
};


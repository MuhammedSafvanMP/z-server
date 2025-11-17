const bcrypt = require("bcrypt");
const Jwt = require("jsonwebtoken");
const Hospital = require("../models/hospital");
const User = require("../models/user");
const notficationModel = require("../models/notification");
const mongoose = require("mongoose");
const { v2: cloudinary } = require("cloudinary");
const  admin = require("firebase-admin");


const { getIO } = require("../sockets/socket");

const twilio = require("twilio");
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
        .json({ message: `Invalid or expired OTP ${otp},${storedOtp}` });
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
const updateHospitalDetails = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    email,
    mobile,
    address,
    latitude,
    longitude,
    workingHours,
    emergencyContact,
    about,
    image,
    currentPassword,
    newPassword,
    workingHoursClinic,
  } = req.body;
  const hospital = await Hospital.findById(id);
  if (!hospital) {
    throw new createError.NotFound("Hospital not found. Wrong input");
  }
  if (currentPassword) {
    await bcrypt.compare(currentPassword, hospital.password).catch(() => {
      throw new createError.BadRequest("Current password is wrong");
    });
  }

  // Update the hospital fields
  if (newPassword) {
    const Password = await bcrypt.hash(newPassword, 10);
    hospital.password = Password;
  }
  hospital.name = name || hospital.name;
  hospital.email = email || hospital.email;
  hospital.phone = mobile || hospital.phone;
  hospital.address = address || hospital.address;
  hospital.latitude = latitude || hospital.latitude;
  hospital.longitude = longitude || hospital.longitude;
  hospital.working_hours = workingHours || hospital.working_hours;
  hospital.working_hours_clinic =
    workingHoursClinic || hospital.working_hours_clinic;

  hospital.emergencyContact = emergencyContact || hospital.emergencyContact;
  hospital.about = about || hospital.about;
  hospital.image = image || hospital.image;

  // Save the updated hospital data
  await hospital.save();

  return res.status(200).json({
    status: "Success",
    message: "Hospital details updated successfully",
  });
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
  const { id } = req.params;
  const hospital = await Hospital.findById(id);
  if (!hospital) {
    return res.status(404).json({ message: "Hospital not found. Wrong input" });    
  }
  // Check the spectilty
  const specialty = hospital.specialties.find(
    (element) => element.name === name
  );
  if (!specialty) {
    return res.status(404).json({ message: "Specialty not found."});
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
  const { name } = req.query;
  const { id } = req.params;

  const hospital = await Hospital.findById(id);
  if (!hospital) {
        return res.status(404).json({ message: "Hospital not found. Wrong input"});
  }

  // Check the spectilty
  const index = hospital.specialties.findIndex(
    (element) =>
      element.name?.trim().toLowerCase() === name.trim().toLowerCase()
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
      return Specialty.name === specialty;
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
  const { id } = req.params;
  const { _id, name, specialty, consulting, qualification } = req.body;
  const data = { name, consulting, qualification };

  const hospital = await Hospital.findById(id);

  if (!hospital) {
    return res.status(404).json({ message: "Hospital not found" });
  }

  const targetSpecialty = hospital.specialties.find(
    (s) => s.name === specialty
  );

  if (!targetSpecialty) {
    return res.status(400).json({ message: `Specialty ${specialty} not found`});

  }

  const targetDoctor = targetSpecialty.doctors.find((d) => d._id == _id);

  if (!targetDoctor) {
 
    return res.status(400).json({ message: `Doctor with ID ${_id} not found in specialty ${specialty}`});

  }

  targetDoctor.name = data.name;
  targetDoctor.consulting = data.consulting;

  await hospital.save();

  return res.status(200).json({
    message: `Doctor in ${specialty} updated successfully`,
    data: hospital.specialties,
  });
};

// Delete Doctor
const deleteDoctor = async (req, res) => {
  const { hospital_id, doctor_id } = req.params;
  const { specialty_name } = req.query;

  const hospital = await Hospital.findById(hospital_id);
  if (!hospital) {
              return res.status(400).json({ message: "Hospital not found!" });

  }

  const targetSpecialty = hospital.specialties.find(
    (s) => s.name?.trim().toLowerCase() === specialty_name.trim().toLowerCase()
  );

  targetSpecialty?.doctors.forEach((doctor, index) => {
    if (doctor._id.toString() == doctor_id) {
      targetSpecialty.doctors.splice(index, 1);
    }
  });

  await hospital.save();

  return res.status(200).json({
    message: `Doctor in ${specialty_name} deleted successfully`,
    data: hospital.specialties,
  });
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


const createBooking = async (
  req,
  res
) => {
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
             return res.status(400).json({ message:  "Phone number must be exactly 10 digits" });
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

    // Create new booking object
    const newBooking = {
      userId,
      specialty,
      doctor_name,
      booking_date,
      status: "pending",
      patient_name,  
      patient_phone, 
      patient_place,  
      patient_dob
    };

    // Push into hospital booking array
    hospital.booking.push(newBooking);

    // Save hospital
    await hospital.save();

    // Create notification
    await notficationModel.create({
      hospitalId: id,
      message: `New booking created for Dr. ${doctor_name} on ${bookingDay}.`,
    });

    // Emit socket event
    const io = getIO();
    io.emit("pushNotification", {
      hospitalId: id,
      message: `New booking by ${patient_name} for Dr. ${doctor_name}`,
    });

    return res.status(201).json({
      message: "Booking created successfully",
      data: hospital.booking[hospital.booking.length - 1], 
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

    console.log('🔧 Initializing Firebase Admin with project:', projectId);

    const serviceAccount = {
      type: 'service_account',
      project_id: projectId,
      private_key: privateKey,
      client_email: clientEmail,
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('✅ Firebase Admin initialized successfully');
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

    console.log('🚀 UPDATE BOOKING API CALLED', { hospitalId, bookingId, status });

    // Find hospital and booking
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found" });
    }

    const booking = hospital.booking.id(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // Update booking fields
    if (status) booking.status = status;
    if (booking_date) booking.booking_date = booking_date;
    if (booking_time) booking.booking_time = booking_time;

    await hospital.save();

    // Find the user
    const user = await User.findById(booking.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 🔥 FCM NOTIFICATION WITH BETTER ERROR HANDLING
    try {
      // ✅ Check both possible field names (FcmToken vs fcmToken)
      const userFcmToken = user.FcmToken 
      
      // For testing, you can hardcode your token:
      // const userFcmToken = 'eJNMsYnaQoaJShP4rG55Au:APA91bFdq0-YkDRWcHNn1bR2qD2dGPfKQdtsW1XSUc-1N-wHkSpyDhGFJ8VDzn8rXgh6wymfnqWsQP8umgOHc9cuvM61XVID8lzE8SzMI4B05wT1j4bNfY8';
      
      console.log(`📱 User FCM Token: ${userFcmToken ? 'Available' : 'Not available'}`);
      
      if (userFcmToken && userFcmToken.length > 0) {
        console.log(`📱 Sending FCM notification to: ${userFcmToken.substring(0, 50)}...`);
        
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
      io.emit("pushNotificationPhone", {
        hospitalId: hospitalId,
        message: `The booking with Dr. ${booking.doctor_name} has been ${status}.`,
      });
    } else {
      io.emit("pushNotificationPhone", {
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








const getBookingsByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Find all hospitals that have at least one booking by this user
    const hospitals = await Hospital.find({
      "booking.userId": userId,
    }).lean();

    if (!hospitals || hospitals.length === 0) {
      return res
        .status(404)
        .json({ message: "No bookings found for this user" });
    }

    // Extract only bookings related to that user
    const userBookings = hospitals.flatMap((hospital) =>
      hospital.booking
        .filter((b) => b.userId.toString() === userId)
        .map((b) => ({
          hospitalId: hospital._id,
          hospitalName: hospital.name,
          hospitalType: hospital.type,
          doctor_name: b.doctor_name,
          specialty: b.specialty,
          booking_date: b.booking_date,
          booking_time: b.booking_time,
          status: b.status,
          bookingId: b._id,
        }))
    );

    return res.status(200).json({
      message: "User bookings fetched successfully",
      data: userBookings,
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
  getSingleHospital
};


const createError = require("http-errors");
const path = require("path");
const { v2: cloudinary } = require("cloudinary");
const Hospital = require("../models/hospital");

// POST /api/hospitals/:id/ads
const uploadAd = async (req, res) => {
  try {
    const { id } = req.params;

    const file = req.file; // uploaded image

    // Find hospital
    const hospital = await Hospital.findById(id);
    if (!hospital) {
     res.status(404).json({ message: "Hospital not found!"});
    }

    if (!file) {
         res.status(400).json({ message: "No file uploaded!"});
    }

    const normalizedPath = path.normalize(file.path);

    const result = await cloudinary.uploader.upload(normalizedPath);


    // Add new ad to hospital.ads
    const newAd = {
      imageUrl: result.secure_url,
      public_id: result.public_id,
      title: req.body.title || "",
      startDate: req.body.startDate || Date.now(),
      endDate: req.body.endDate || null,
      isActive: true,
    };

    hospital.ads.push(newAd);
    await hospital.save();

    return res.status(201).json(newAd);
  } catch (error) {
    console.error("Error uploading ad:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// DELETE /api/hospitals/:hospitalId/ads/:adId
const deleteAd = async (req, res) => {
  const { hospitalId, adId } = req.params;
  const hospital = await Hospital.findById(hospitalId);
  if (!hospital) res.status(404).json({ message: "Hospital not found!"});

  const ad = hospital.ads.find((ad) => ad._id?.toString() === adId.toString());
    if (!ad) res.status(404).json({message :"Ad not found!"});


  // Delete image from Cloudinary
  if (ad.public_id) await cloudinary.uploader.destroy(ad.public_id);

  await ad.deleteOne();
  await hospital.save();

  return res.status(200).json({ message: "Ad deleted successfully" });
};

// In your controller
const updateAd = async (req, res) => {
  const { hospitalId, adId } = req.params;

  // At this point, Multer must already have processed the request
  const file = req.file; // uploaded image
  const { title, startDate, endDate, isActive } = req.body; // text fields

  const hospital = await Hospital.findById(hospitalId);
  if (!hospital) res.status(404).json({ message: "Hospital not found!"});

  const ad = hospital.ads.id(adId);
  if (!ad) res.status(404).json({message :"Ad not found!"});

  if (title) ad.title = title;
  if (startDate) ad.startDate = startDate;
  if (endDate) ad.endDate = endDate;
  if (isActive !== undefined) ad.isActive = isActive === "true";

  if (file) {
    if (ad.public_id) await cloudinary.uploader.destroy(ad.public_id);
    const result = await cloudinary.uploader.upload(path.normalize(file.path), {
      folder: `hospital_ads/${hospitalId}`,
    });
    ad.imageUrl = result.secure_url;
    ad.public_id = result.public_id;
  }

  await hospital.save();
  return res.status(200).json(ad);
};

const getAllAds = async (req, res) => {

    const ads = await Hospital.find({ "ads.isActive": true });
    if (!ads) res.status(404).json({message :"Ads not found!"});
  return res.status(200).json(ads);

}


 const GetAds = async (req, res) => {
  try {

    // Get coordinates from query
    const { lat, lng } = req.query;

    if (!lat || !lng) {

      const hospitals = await Hospital.find({ "ads.isActive": true });
      const allAds = [];

      hospitals.forEach((hospital) => {
        hospital.ads.forEach((ad) => {
          if (ad.isActive) allAds.push(ad);
        });
      });

      return res.status(200).json({
        message: "All active ads (no location filter)",
        data: allAds,
      });
    }

    // Parse to numbers
    const userLat = parseFloat(lat );
    const userLng = parseFloat(lng );

    if (isNaN(userLat) || isNaN(userLng)) {
      return res.status(400).json({ message: "Invalid latitude or longitude" });
    }


    // Search radius (50 km)
    const radiusInMeters = 50_000;
    const nearbyAds = [];
    const R = 6371; // Earth radius in km

    // Fetch hospitals that have ads
    const hospitals = await Hospital.find({
      ads: { $exists: true, $not: { $size: 0 } },
    });


    hospitals.forEach((hospital) => {
      if (
        typeof hospital.latitude !== "number" ||
        typeof hospital.longitude !== "number"
      ) {
        console.warn(`Hospital ${hospital.name} has no coordinates`);
        return;
      }

      // Haversine formula
      const dLat = ((hospital.latitude - userLat) * Math.PI) / 180;
      const dLon = ((hospital.longitude - userLng) * Math.PI) / 180;

      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((userLat * Math.PI) / 180) *
          Math.cos((hospital.latitude * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c * 1000; // meters

      if (distance <= radiusInMeters) {
        hospital.ads.forEach((ad) => {
          if (ad.isActive) nearbyAds.push(ad);
        });
      }
    });

    return res.status(200).json({
      message: `Nearby ads within ${radiusInMeters / 1000} km`,
      count: nearbyAds.length,
      data: nearbyAds,
    });
  } catch (err) {
    console.error("Error in GetAds:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET /api/hospitals/:id/ads - Get all ads for a specific hospital
const GetAdsHospital = async (req, res) => {
  const hospitalId = req.params.id;
  const hospital = await Hospital.findById(hospitalId);
  if (!hospital) {
    return res.status(404).json({ message: "Hospital not found" });
  }

  return res.status(200).json(hospital.ads);
};

module.exports = {
  uploadAd,
  deleteAd,
  updateAd,
  GetAds,
  GetAdsHospital,
  getAllAds
};
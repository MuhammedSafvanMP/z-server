// routes/hospitalAdsRoutes.js
const { Router } = require("express");
const {
  uploadAd,
  deleteAd,
  updateAd,
  GetAds,
  GetAdsHospital,
} = require("../controllers/carousel");
const { upload } = require("../middlewares/multer");

const CarouselRouter = Router();

// -------------------------
// Hospital Ads Routes
// -------------------------

// Get /api/hospitals/:id/ads - Get all ads for a specific hospital
CarouselRouter.get("/hospitals/ads/:id", GetAdsHospital);

// Create/upload a new ad for a hospital
// POST /api/hospitals/ads/:id
CarouselRouter.post("/hospitals/ads/:id", upload.single("image"), uploadAd);

// Update an existing ad
// PUT /api/hospitals/ads/:hospitalId/:adId
CarouselRouter.put("/hospitals/ads/:hospitalId/:adId", upload.single("image"), updateAd);

// Delete an ad
// DELETE /api/hospitals/ads/:hospitalId/:adId
CarouselRouter.delete("/hospitals/ads/:hospitalId/:adId", deleteAd);

// Get nearby ads
// GET /api/ads/nearby?lat=...&lng=...
CarouselRouter.get("/ads/nearby", GetAds);

module.exports = CarouselRouter;
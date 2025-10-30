const Lab = require("../models/lab"); 
const createError = require("http-errors");

// ✅ Create a Lab
const createLab = async (req, res) => {
  const { name, email, phone, time, services, location } = req.body;

  const exists = await Lab.findOne({ email });
  if (exists) throw new createError.Conflict("Email already exists");

  const lab = new Lab({ name, email, phone, time, services, location });
  await lab.save();

  return res.status(201).json({ message: "Lab created successfully", lab });
};

// 🔍 Get All Labs (with pagination & search)
const getLabs = async (req, res) => {
  const { page = 1, limit = 10, search = "", pincode, place } = req.query;

  const query = {
    $or: [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { "location.place": { $regex: search, $options: "i" } },
    ],
  };

  if (pincode) query["location.pincode"] = +pincode;
  if (place) query["location.place"] = { $regex: place, $options: "i" };

  const labs = await Lab.find(query)
    .skip((+page - 1) * +limit)
    .limit(+limit)
    .sort({ createdAt: -1 });

  const total = await Lab.countDocuments(query);

  return res.status(200).json({ labs, total, page: +page, totalPages: Math.ceil(total / +limit) });
};

// 📄 Get Single Lab
const getSingleLab = async (req, res) => {
  const { id } = req.params;

  if (!id) throw new createError.BadRequest("Invalid Lab ID");

  const lab = await Lab.findById(id);
  if (!lab) throw new createError.NotFound("Lab not found");

  return res.status(200).json(lab);
};

// 📝 Update Lab
const updateLab = async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  if (!id) throw new createError.BadRequest("Invalid Lab ID");

  const lab = await Lab.findByIdAndUpdate(id, updateData, { new: true });
  if (!lab) throw new createError.NotFound("Lab not found");

  return res.status(200).json({ message: "Lab updated", lab });
};

// ❌ Delete Lab
const deleteLab = async (req, res) => {
  const { id } = req.params;

  if (!id) throw new createError.BadRequest("Invalid Lab ID");

  const lab = await Lab.findByIdAndDelete(id);
  if (!lab) throw new createError.NotFound("Lab not found");

  return res.status(200).json({ message: "Lab deleted successfully" });
};

module.exports = {
  createLab,
  getLabs,
  getSingleLab,
  updateLab,
  deleteLab
};
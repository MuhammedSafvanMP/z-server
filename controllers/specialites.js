const specialityModle = require("../models/specialties");



const getSpcilities = async (req, res) => {
  try {
    const speciality = await specialityModle.find().sort({ createdAt: -1 });

    return res.status(200).json(speciality);
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};


const getASpcilities = async (req, res) => {
  try {

    const { id } = req.params; 

    const speciality = await specialityModle.findById(id).sort({ createdAt: -1 });

    return res.status(200).json(speciality);
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};


const deleteASpcilities = async (req, res) => {
  try {

    const { id } = req.params; 

  await specialityModle.findByIdAndDelete(id).sort({ createdAt: -1 });

    return res.status(200).json({message: "Specialite delete successfully"});
  } catch (error) {
    return res.status(500).json({ message: "Server error", error });
  }
};

module.exports = {
  getSpcilities,
   getASpcilities,
   deleteASpcilities
};
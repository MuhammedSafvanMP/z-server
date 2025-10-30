const Notification = require("../models/notification");

const getUserUnread = async (req, res) => {
  try {
    const notifications = await Notification.find({
      userId: req.params.id,
      userIsRead: false,
    }).sort({ createdAt: -1 });

    return res.status(200).json(notifications);
  } catch (error) {
    console.error("Error fetching user unread notifications:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

const getHospitalUnread = async (req, res) => {
  try {
    const notifications = await Notification.find({
      hospitalId: req.params.id,
      hospitalIsRead: false,
    }).sort({ createdAt: -1 });

    return res.status(200).json(notifications);
  } catch (error) {
    console.error("Error fetching hospital unread notifications:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

const getUserRead = async (req, res) => {
  try {
    const notifications = await Notification.find({
      userId: req.params.id,
      userIsRead: true,
    }).sort({ createdAt: -1 });

    return res.status(200).json(notifications);
  } catch (error) {
    console.error("Error fetching user read notifications:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

const getHospitalRead = async (req, res) => {
  try {
    const notifications = await Notification.find({
      hospitalId: req.params.id,
      hospitalIsRead: true,
    }).sort({ createdAt: -1 });

    return res.status(200).json(notifications);
  } catch (error) {
    console.error("Error fetching hospital read notifications:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

const updateUser = async (req, res) => {
  try {
    const updatedNotification = await Notification.findByIdAndUpdate(
      req.params.id,
      { userIsRead: true },
      { new: true }
    );

    if (!updatedNotification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.status(200).json({
      status: 200,
      updatedNotification,
    });
  } catch (error) {
    console.error("Error updating user notification:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

const updateUserAll = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.params.id },     
      { $set: { userIsRead: true } }  
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "No notifications found for this user" });
    }

    return res.status(200).json({
      status: 200,
      message: "All user notifications marked as read",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error updating user notifications:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

const updateHospitalAll = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { hospitalId: req.params.id },     
      { $set: { hospitalIsRead: true } }  
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "No notifications found for this Hospital" });
    }

    return res.status(200).json({
      status: 200,
      message: "All user notifications marked as read",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error updating user notifications:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

const updateHospital = async (req, res) => {
  try {
    const updatedNotification = await Notification.findByIdAndUpdate(
      req.params.id,
      { hospitalIsRead: true },
      { new: true }
    );

    if (!updatedNotification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.status(200).json({
      status: 200,
      updatedNotification,
    });
  } catch (error) {
    console.error("Error updating hospital notification:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};

module.exports = {
  getUserUnread,
  getHospitalUnread,
  getUserRead,
  getHospitalRead,
  updateUser,
  updateUserAll,
  updateHospitalAll,
  updateHospital
};
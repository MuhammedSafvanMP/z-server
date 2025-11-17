// src/sockets/socket.js
const { Server } = require("socket.io");
const dotenv = require("dotenv");

dotenv.config({ path: "./Config/.env" });

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      // origin: [
      //   process.env.UserSide_URL,
      //   process.env.AmbulanceSide_URL,
      //   process.env.HospitalSide_URL,
      //   process.env.AdminSide_URL,
      //   "https://hosta-hospitals.vercel.app",
      //   "http://localhost:5173",
      // ],
      origin: "*",
      credentials: true,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"], // allow both
  });

  io.engine.on("connection_error", (err) => {
    console.log("Socket connection error:", err);
  });

  io.on("connection", (socket) => {
    console.log("✅ Client connected:", socket.id);

    socket.on("disconnect", (reason) => {
      console.log("❌ Client disconnected:", socket.id, "Reason:", reason);
    });

    socket.on("error", (error) => {
      console.log("⚠️ Socket error:", error);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized!");
  return io;
};

module.exports = { initSocket, getIO };

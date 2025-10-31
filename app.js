// app.js
const express = require("express");
const http = require("http");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config({ path: "./Config/.env" });

const { initSocket } = require("./sockets/socket");
const connectToDb = require("./config/dbConnection");

// Routers
const indexRouter = require("./routes/index");
const usersRouter = require("./routes/users");
const hospetalRouter = require("./routes/hospitals");
const ambulanceRouter = require("./routes/ambulance");
const bloodRouter = require("./routes/blood");
const carouselRouter = require("./routes/carousel");
const commenRouter = require("./routes/commen");
const labRouter = require("./routes/labs");
const notificationRouter = require("./routes/notifications");

// Initialize Express
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Connect to MongoDB
connectToDb();

// Middleware
app.use(
  cors({
    origin: [
      process.env.UserSide_URL,
      process.env.AmbulanceSide_URL,
      process.env.HospitalSide_URL,
      process.env.AdminSide_URL,
      "http://127.0.0.1:5500",
      "https://hosta-hospitals.vercel.app",
      "http://localhost:5173",
    ],
    credentials: true,
  })
);

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Routes
app.use("/", indexRouter);
app.use("/api", usersRouter);
app.use("/api", commenRouter);
app.use("/api", hospetalRouter);
app.use("/api", ambulanceRouter);
app.use("/api", notificationRouter);
app.use("/api", labRouter);
app.use("/api", carouselRouter);
app.use("/api", bloodRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 404,
    message: "The requested resource was not found",
    path: req.path,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    status: err.status || 500,
    message: err.message || "Internal Server Error",
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;

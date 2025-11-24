// var createError = require('http-errors');
// var http = require('http');
// var express = require('express');
// var path = require('path');
// var cookieParser = require('cookie-parser');
// var logger = require('morgan');
// var limiter = require('./config/rateLimiter');
// var { initSocket } =  require('./sockets/socket');
// var cors = require('cors');



// var indexRouter = require('./routes/index');
// var usersRouter = require('./routes/users');
// var hospetalRouter =  require('./routes/hospitals');
// var ambulanceRouter =  require('./routes/ambulance');
// var bloodRouter =  require('./routes/blood');
// var carouselRouter =  require('./routes/carousel');
// var commenRouter =  require('./routes/commen');
// var labRouter =  require('./routes/labs');
// var notificationRouter =  require('./routes/notifications');
// const connectToDb = require('./config/dbConnection');



// var app = express();
// var server = http.createServer(app);

// initSocket(server);

// app.use(
//   cors({
//     origin: [
//       process.env.UserSide_URL,
//       process.env.AmbulanceSide_URL,
//       process.env.HospitalSide_URL,
//       process.env.AdminSide_URL,
//       "http://127.0.0.1:5500",
//       "https://hosta-hospitals.vercel.app",
//       "http://localhost:5173",
//     ],
//     credentials: true,
//   })
// );

// // view engine setup
// app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'jade');

// app.use(logger('dev'));
// app.use(express.json());
// app.use(express.urlencoded({ extended: false }));
// app.use(cookieParser());
// app.use(express.static(path.join(__dirname, 'public')));


// app.use(limiter)


// app.use('/', indexRouter);


// app.use("/api", usersRouter);
// app.use("/api", commenRouter);
// app.use("/api", hospetalRouter);
// app.use("/api", ambulanceRouter);
// app.use("/api", notificationRouter);
// app.use("/api", labRouter);
// app.use("/api", carouselRouter);
// app.use("/api", bloodRouter);



// connectToDb();


// // catch 404 and forward to error handler
// app.use((req, res, next) => {
//   res.status(404).json({
//     status: 404,
//     message: "The requested resource was not found",
//     path: req.path,
//   });
// });

// // error handler
// app.use((err, req, res, next) => {
//   // Set locals, only providing error in development
//   const error = req.app.get("env") === "development" ? err : {};

//   // Send error response
//   res.status(err.status || 500).json({
//     status: err.status || 500,
//     message: err.message || "Internal Server Error",
//     error: req.app.get("env") === "development" ? error : {},
//   });
// });


// module.exports = app;


var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var limiter = require('./config/rateLimiter');
var cors = require('cors');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var hospetalRouter = require('./routes/hospitals');
var ambulanceRouter = require('./routes/ambulance');
var bloodRouter = require('./routes/blood');
var carouselRouter = require('./routes/carousel');
var commenRouter = require('./routes/commen');
var labRouter = require('./routes/labs');
var notificationRouter = require('./routes/notifications');
var specialitesRouter = require('./routes/specialties');
const connectToDb = require('./config/dbConnection');

var app = express();

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
      "http://localhost:7864",
      "https://www.hostahospital.com",
      "https://hostahospital.com",
    ],
    credentials: true,
  })
);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


// app.use(limiter)


app.use('/', indexRouter);
app.use("/api", usersRouter);
app.use("/api", commenRouter);
app.use("/api", hospetalRouter);
app.use("/api", ambulanceRouter);
app.use("/api", notificationRouter);
app.use("/api", labRouter);
app.use("/api", carouselRouter);
app.use("/api", bloodRouter);
app.use("/api", specialitesRouter);


connectToDb();

// catch 404 and forward to error handler
app.use((req, res, next) => {
  res.status(404).json({
    status: 404,
    message: "The requested resource was not found",
    path: req.path,
  });
});

// error handler
app.use((err, req, res, next) => {
  const error = req.app.get("env") === "development" ? err : {};
  res.status(err.status || 500).json({
    status: err.status || 500,
    message: err.message || "Internal Server Error",
    error: req.app.get("env") === "development" ? error : {},
  });
});

module.exports = app;

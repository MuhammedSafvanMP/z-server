var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var limiter = require('./config/rateLimiter');


var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var hospetalRouter =  require('./routes/hospitals');
var ambulanceRouter =  require('./routes/ambulance');
var bloodRouter =  require('./routes/blood');
var carouselRouter =  require('./routes/carousel');
var commenRouter =  require('./routes/commen');
var labRouter =  require('./routes/labs');
var notificationRouter =  require('./routes/notifications');
const connectToDb = require('./config/dbConnection');



var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


app.use(limiter)


app.use('/', indexRouter);


app.use("/api", usersRouter);
app.use("/api", commenRouter);
app.use("/api", hospetalRouter);
app.use("/api", ambulanceRouter);
app.use("/api", notificationRouter);
app.use("/api", labRouter);
app.use("/api", carouselRouter);
app.use("/api", bloodRouter);



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
  // Set locals, only providing error in development
  const error = req.app.get("env") === "development" ? err : {};

  // Send error response
  res.status(err.status || 500).json({
    status: err.status || 500,
    message: err.message || "Internal Server Error",
    error: req.app.get("env") === "development" ? error : {},
  });
});


module.exports = app;

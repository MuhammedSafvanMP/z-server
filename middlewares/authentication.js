const createError = require("http-errors");
const jwt = require("jsonwebtoken");

const Auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      throw new createError.Unauthorized("No token provided. Please login.");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded) {
      throw new createError.Unauthorized("Invalid token. Please login.");
    }

    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return next(new createError.Unauthorized("Invalid or expired token."));
    }
    next(err);
  }
};

module.exports = Auth;
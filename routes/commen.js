const Express = require("express");
const { trycatch } = require("../utils/tryCatch");
const { Logout, Refresh, sendMail } = require("../controllers/commen");
const Authenticator = require("../middlewares/authentication");

const commenRoutes = Express.Router();

commenRoutes.post("/email", trycatch(sendMail));
commenRoutes.get("/refresh", trycatch(Refresh));
commenRoutes.get("/logout", Authenticator, trycatch(Logout));

module.exports = commenRoutes;
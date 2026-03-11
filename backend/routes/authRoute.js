const express = require("express");
const {
  login,
  manualLogin,
  register,
} = require("../controllers/authController");

const authRouter = express.Router();

authRouter.post("/login", login); // existing OAuth login
authRouter.post("/manual-login", manualLogin); // email-password login
authRouter.post("/register", register); // manual registration

module.exports = authRouter;

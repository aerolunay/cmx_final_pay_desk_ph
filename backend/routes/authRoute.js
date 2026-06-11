const express = require("express");

const {
  login,
  manualLogin,
  register,
} = require("../controllers/authController");

const authRouter = express.Router();

/*
  Public authentication routes.

  Keep these public only if the controller itself is safe:
  - generic login errors
  - rate limited at index.js level
  - no user enumeration
*/
authRouter.post("/login", login);
authRouter.post("/manual-login", manualLogin);

/*
  Registration must NOT be public.

  This route expects index.js to inject:
  - req.requireAuth
  - req.requireAdminAccess

  If those are not present, it fails closed.
*/
function requireInjectedAuth(req, res, next) {
  if (typeof req.requireAuth !== "function") {
    return res.status(500).json({
      success: false,
      error: "Authentication middleware is not configured.",
    });
  }

  return req.requireAuth(req, res, next);
}

function requireInjectedAdminAccess(req, res, next) {
  if (typeof req.requireAdminAccess !== "function") {
    return res.status(500).json({
      success: false,
      error: "Authorization middleware is not configured.",
    });
  }

  return req.requireAdminAccess(req, res, next);
}

authRouter.post(
  "/register",
  requireInjectedAuth,
  requireInjectedAdminAccess,
  register
);

module.exports = authRouter;
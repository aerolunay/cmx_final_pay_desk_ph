import React from "react";
import { Routes, Route, Navigate, useLocation, Outlet } from "react-router-dom";
import OauthLogin from "./components/Routes/OauthLogin";
import Home from "./components/Routes/Home";
import ProcessFinalPay from "./components/Routes/ProcessFinalPay";
import UserManagement from "./components/Routes/UserManagement";
import OtpVerification from "./components/common/OtpVerification";

import UserService from "./service/UserService";

// ✅ Route Guard: Checks if user is authenticated
function RequireAuth() {
  const location = useLocation();
  const authed = UserService.isAuthenticated();
  return authed ? (
    <Outlet />
  ) : (
    <Navigate to="/OauthLogin" replace state={{ from: location }} />
  );
}

// ✅ Route Guard: Prevents access if access level is "User"
function RequireAdminOrHigher() {
  const location = useLocation();
  const accessLevel = localStorage.getItem("user_access_level");

  return accessLevel !== "User" ? (
    <Outlet />
  ) : (
    <Navigate to="/ProcessFinalPay" replace state={{ from: location }} />
  );
}

// ✅ Routes
export default function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<OauthLogin />} />
      <Route path="/OauthLogin" element={<OauthLogin />} />
      <Route path="/OTP-SECURE" element={<OtpVerification />} />

      {/* Protected Routes */}
      <Route element={<RequireAuth />}>
        {/* Only allow non-"User" roles to access ClientRoster */}
        <Route element={<RequireAdminOrHigher />}>
          <Route path="/UserManagement" element={<UserManagement />} />
        </Route>

        {/* Accessible by all authenticated users */}
        <Route path="/Home" element={<Home />} />
        <Route path="/ProcessFinalPay" element={<ProcessFinalPay />} />
      </Route>
    </Routes>
  );
}

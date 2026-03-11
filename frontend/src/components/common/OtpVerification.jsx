import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import bcrypt from "bcryptjs";
import UserService from "../../service/UserService";
import pkg from "../../../package.json"

const OtpVerification = () => {
  const navigate = useNavigate();
  const APP_VERSION = pkg.version;
  const location = useLocation();

  const emailAddress =
    location.state?.emailAddress || localStorage.getItem("pendingEmail");

  // const requestedDateTime =
  //   location.state?.requestedDateTime ||
  //   localStorage.getItem("pendingRequestedAt");

  const expiryDateTime =
    location.state?.expiryDateTime ||
    localStorage.getItem("pendingExpiryAt");

  if (location.state?.emailAddress) {
    localStorage.setItem("pendingEmail", location.state.emailAddress);
  }

  const [enteredOtp, setEnteredOtp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleVerifyOtp = async () => {
    setError("");
    setSuccess("");

    if (!emailAddress) return setError("Missing email. Please restart login.");
    if (!enteredOtp) return setError("Please enter the OTP.");
    if (!expiryDateTime)
      return setError("Session expired. Please request a new OTP.");

    const expiry = new Date(expiryDateTime);
    if (new Date() > expiry)
      return setError("OTP has expired. Please request a new one.");

    const hashedOtp = localStorage.getItem("pendingOtpHashed");
    if (!hashedOtp) return setError("No OTP found. Please try again.");

    const isMatch = await bcrypt.compare(enteredOtp, hashedOtp);
    if (!isMatch) return setError("Incorrect OTP. Please try again.");

    setSuccess("OTP verified successfully!");

    try {
      const pendingUser = UserService.getPendingUser?.();
      if (!pendingUser)
        return setError("Session missing. Please restart login.");

      const {
        userid,
        userEmail,
        firstName,
        lastName,
        fullName,
        userLevel,
        userStatus,
      } = pendingUser;

      if (userStatus?.toLowerCase() !== "active") {
        return setError("This account is not active.");
      }

      UserService.loginUser({
        userId: userid,
        email: userEmail || emailAddress,
        firstname: firstName || fullName || "",
        lastname: lastName || "",
        providerId: emailAddress,
        userLevel,
        userStatus,
      });

      localStorage.removeItem("pendingEmail");
      localStorage.removeItem("pendingRequestedAt");
      localStorage.removeItem("pendingExpiryAt");
      localStorage.removeItem("pendingOtpHashed");

      UserService.clearPendingUser?.();

      navigate("/Home", { replace: true });
    } catch (err) {
      console.error(err);
      setError("Verification failed. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-[#061326] via-[#0b2c5f] to-[#3b63c4]">

      {/* Glow accents */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="w-72 h-72 bg-[#00a1c9]/20 rounded-full blur-3xl absolute -top-20 -left-16" />
        <div className="w-72 h-72 bg-[#00a1c9]/10 rounded-full blur-3xl absolute bottom-0 right-0" />
      </div>

      {/* Glass card */}
      <div className="relative w-full max-w-sm bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-8 py-9 shadow-2xl">

        <h2 className="text-2xl font-semibold text-white mb-2 text-center">
          Verify OTP
        </h2>

        <p className="text-sm text-white/80 text-center mb-6">
          Enter the one-time code sent to
          <br />
          <span className="font-medium">{emailAddress}</span>
        </p>

        <input
          type="text"
          maxLength={6}
          value={enteredOtp}
          onChange={(e) => setEnteredOtp(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
          placeholder="● ● ● ● ● ●"
          className="w-full bg-white/15 border border-white/30 rounded-lg px-3 py-3 text-center text-xl tracking-widest text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#00a1c9]"
        />

        {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
        {success && <p className="text-green-400 text-xs mt-3">{success}</p>}

        <button
          onClick={handleVerifyOtp}
          className="w-full mt-6 py-2.5 rounded-lg text-sm font-medium text-white bg-[#00a1c9] hover:bg-[#0084a4] transition"
        >
          Verify OTP
        </button>

        <p className="text-[11px] text-white/60 mt-6 text-center">
          This OTP will expire in 3 minutes.
        </p>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 text-center text-[10px] text-white/70">
        <p>© 2025 CMX FinalPay Desk v{APP_VERSION}</p>
        <p>DREAM Dev Ops || Callmax Solutions International</p>
      </div>

    </div>
  );
};

export default OtpVerification;

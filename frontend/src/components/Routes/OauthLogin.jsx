import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SERVER_URL } from "../lib/constants";
import logo from "../../assets/callmax_cover_removebg.png";
import UserService from "../../service/UserService";
import pkg from "../../../package.json"

const OauthLogin = () => {
  const navigate = useNavigate();
  const APP_VERSION = pkg.version;
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);

  const isCallmaxEmail = (value) => {
    const trimmed = (value || "").trim().toLowerCase();
    return trimmed.endsWith("@callmaxsolutions.com");
  };

  const handleManualOtpLogin = async () => {
    setError("");

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    if (!isCallmaxEmail(email)) {
      setError("Please use your Callmax email address.");
      return;
    }

    setIsSending(true);

    try {
      const checkRes = await fetch(`${SERVER_URL}/api/check-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const checkData = await checkRes.json();

      if (!checkRes.ok || !checkData.success) {
        setError(checkData.error || "Email is not registered or not authorized.");
        return;
      }

      const {
        empId,
        userid,
        userEmail,
        lastName,
        firstName,
        fullName,
        userLevel,
        userStatus,
      } = checkData.user || {};

      if (userStatus?.toLowerCase() !== "active") {
        setError("This account is not active. Please contact your administrator.");
        return;
      }

      UserService.setPendingUser({
        empId,
        userid,
        userEmail,
        lastName,
        firstName,
        fullName,
        userLevel,
        userStatus,
      });

      const requestedDateTime = new Date();
      const expiryDateTime = new Date(requestedDateTime.getTime() + 3 * 60000);

      const otpRes = await fetch(`${SERVER_URL}/sendOTP`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailAddress: email,
          requestedDateTime: requestedDateTime.toISOString(),
          expiryDateTime: expiryDateTime.toISOString(),
        }),
      });

      if (!otpRes.ok) {
        setError("Failed to send OTP. Please try again.");
        return;
      }

      const result = await otpRes.json();

      localStorage.setItem("pendingOtpHashed", result.otpHashed);
      localStorage.setItem("pendingRequestedAt", requestedDateTime.toISOString());
      localStorage.setItem("pendingExpiryAt", expiryDateTime.toISOString());
      localStorage.setItem("pendingEmail", email);

      navigate("/OTP-SECURE", {
        state: { emailAddress: email, requestedDateTime, expiryDateTime },
      });
    } catch (err) {
      console.error(err);
      setError("An error occurred. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-1">
      
      {/* LEFT — WHITE */}
      {/* <div className="flex flex-col justify-center items-start px-10 lg:px-16 bg-white">
        <img src={logo} alt="Callmax Logo" className="w-56 mb-4" />
        <h2 className="text-2xl font-semibold text-[#0c2545]">
          Quality Portal – PH
        </h2>
        <span className="text-sm text-gray-500 mt-2">v 4.2.5</span>
      </div> */}

      {/* RIGHT — BLUE */}
      <div className="relative flex items-center justify-center bg-gradient-to-br from-[#061326] via-[#0b2c5f] to-[#3b63c4] px-6">

        {/* Glass Card */}
        <div className="w-full max-w-md bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-8 py-9 shadow-2xl">
          <div className="flex flex-col items-center justify-center mb-6">
            <img
              src={logo}
              alt="Callmax Logo"
              className="w-60 md:w-64 drop-shadow-sm"
            />
            <h2 className="text-lg font-semibold text-white text-center mb-2">
              FinalPay Desk
            </h2>
            <p className="text-[11px] md:text-xs text-gray-300 mt-1">
              Secure access for Callmax Accounting Team
            </p>
          </div>

          <label className="block text-xs text-white mb-1">
            Email
          </label>
          <input
            type="email"
            placeholder="you@callmaxsolutions.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualOtpLogin()}
            className="w-full rounded-lg bg-white/15 border border-white/30 px-3 py-2.5 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#00a1c9]"
          />

          <button
            onClick={handleManualOtpLogin}
            disabled={isSending}
            className={`w-full mt-5 py-2.5 rounded-lg text-sm font-medium transition
              ${
                isSending
                  ? "bg-white/40 cursor-not-allowed text-white"
                  : "bg-[#00a1c9] hover:bg-[#0084a4] text-white"
              }`}
          >
            {isSending ? "Sending OTP…" : "Request OTP"}
          </button>

          {error && <p className="text-red-400 text-xs mt-4">{error}</p>}
        </div>

        {/* Footer */}
        <div className="absolute bottom-6 text-center text-[10px] text-white/70">
          <p>© 2025 CMX FinalPay Desk v{APP_VERSION}</p>
          <p>DREAM Dev Ops || Callmax Solutions International</p>
        </div>
      </div>
    </div>
  );
};

export default OauthLogin;

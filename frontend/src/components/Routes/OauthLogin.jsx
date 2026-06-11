import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SERVER_URL } from "../lib/constants";
import logo from "../../assets/callmax_cover_removebg.png";
import pkg from "../../../package.json";

const OauthLogin = () => {
  const navigate = useNavigate();
  const APP_VERSION = pkg.version;

  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);

  const normalizeEmail = (value) => {
    return String(value || "").trim().toLowerCase();
  };

  const isCallmaxEmail = (value) => {
    const trimmed = normalizeEmail(value);
    return trimmed.endsWith("@callmaxsolutions.com");
  };

  const handleManualOtpLogin = async () => {
    setError("");

    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail) {
      setError("Invalid Credentials or Authentication Request.");
      return;
    }

    if (!isCallmaxEmail(cleanEmail)) {
      setError("Invalid Credentials or Authentication Request.");
      return;
    }

    setIsSending(true);

    try {
      const checkRes = await fetch(`${SERVER_URL}/api/check-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: cleanEmail }),
      });

      let checkData = null;

      try {
        checkData = await checkRes.json();
      } catch {
        checkData = null;
      }

      if (!checkRes.ok || !checkData?.success || !checkData?.pendingAuthId) {
        setError(
          checkData?.error ||
            "Invalid Credentials or Authentication Request."
        );
        return;
      }

      const requestedDateTime = new Date();
      const expiryDateTime = new Date(
        requestedDateTime.getTime() + 3 * 60 * 1000
      );

      localStorage.setItem("pendingAuthId", checkData.pendingAuthId);
      localStorage.setItem("pendingEmail", cleanEmail);
      localStorage.setItem(
        "pendingRequestedAt",
        requestedDateTime.toISOString()
      );
      localStorage.setItem("pendingExpiryAt", expiryDateTime.toISOString());

      // Remove old insecure OTP artifacts if they exist
      localStorage.removeItem("pendingOtpHashed");
      localStorage.removeItem("pendingUser");

      navigate("/OTP-SECURE", {
        state: {
          emailAddress: cleanEmail,
          pendingAuthId: checkData.pendingAuthId,
          requestedDateTime,
          expiryDateTime,
        },
      });
    } catch (err) {
      console.error("OTP request error:", err);
      setError("Invalid Credentials or Authentication Request.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-1">
      <div className="relative flex items-center justify-center bg-gradient-to-br from-[#061326] via-[#0b2c5f] to-[#3b63c4] px-6">
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

          <label className="block text-xs text-white mb-1">Email</label>

          <input
            type="email"
            placeholder="you@callmaxsolutions.com"
            value={email}
            disabled={isSending}
            autoComplete="email"
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isSending) {
                handleManualOtpLogin();
              }
            }}
            className="w-full rounded-lg bg-white/15 border border-white/30 px-3 py-2.5 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#00a1c9] disabled:opacity-60"
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

          {error && (
            <p className="text-red-400 text-xs mt-4 text-center">{error}</p>
          )}

          {!error && (
            <p className="text-white/60 text-[11px] mt-4 text-center">
              If the login is valid, an OTP will be sent to your email.
            </p>
          )}
        </div>

        <div className="absolute bottom-6 text-center text-[10px] text-white/70">
          <p>© 2026 CMX FinalPay Desk v{APP_VERSION}</p>
          <p>DREAM Dev Ops || Callmax Solutions International</p>
        </div>
      </div>
    </div>
  );
};

export default OauthLogin;
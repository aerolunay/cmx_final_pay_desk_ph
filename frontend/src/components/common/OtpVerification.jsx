import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SERVER_URL } from "../lib/constants";
import UserService from "../../service/UserService";
import pkg from "../../../package.json";

const OtpVerification = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const APP_VERSION = pkg.version;

  const emailAddress = useMemo(() => {
    return (
      location.state?.emailAddress ||
      localStorage.getItem("pendingEmail") ||
      ""
    );
  }, [location.state]);

  const pendingAuthId = useMemo(() => {
    return (
      location.state?.pendingAuthId ||
      localStorage.getItem("pendingAuthId") ||
      ""
    );
  }, [location.state]);

  const expiryDateTime = useMemo(() => {
    return (
      location.state?.expiryDateTime ||
      localStorage.getItem("pendingExpiryAt") ||
      ""
    );
  }, [location.state]);

  const [enteredOtp, setEnteredOtp] = useState("");
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const clearPendingOtpStorage = () => {
    localStorage.removeItem("pendingAuthId");
    localStorage.removeItem("pendingEmail");
    localStorage.removeItem("pendingRequestedAt");
    localStorage.removeItem("pendingExpiryAt");

    // Old insecure artifacts cleanup
    localStorage.removeItem("pendingOtpHashed");
    localStorage.removeItem("pendingUser");

    UserService.clearPendingUser?.();
  };

  const handleVerifyOtp = async () => {
    if (isVerifying) return;

    setError("");

    const cleanOtp = String(enteredOtp || "").trim();

    if (!emailAddress) {
      setError("Missing email. Please restart login.");
      return;
    }

    if (!pendingAuthId) {
      setError("Missing authentication session. Please restart login.");
      return;
    }

    if (!cleanOtp) {
      setError("Please enter the OTP.");
      return;
    }

    if (!/^\d{6}$/.test(cleanOtp)) {
      setError("Please enter the 6-digit OTP.");
      return;
    }

    if (!expiryDateTime) {
      clearPendingOtpStorage();
      setError("Session expired. Please request a new OTP.");
      return;
    }

    const expiry = new Date(expiryDateTime);

    if (Number.isNaN(expiry.getTime()) || new Date() > expiry) {
      clearPendingOtpStorage();
      setError("OTP has expired. Please request a new one.");
      return;
    }

    setIsVerifying(true);

    try {
      const verifyRes = await fetch(`${SERVER_URL}/api/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          pendingAuthId,
          otp: cleanOtp,
        }),
      });

      let verifyData = null;

      try {
        verifyData = await verifyRes.json();
      } catch {
        verifyData = null;
      }

      if (!verifyRes.ok || !verifyData?.success) {
        setError(verifyData?.error || "Invalid or expired OTP.");
        return;
      }

      const { authToken, tokenType = "Bearer", user } = verifyData;

      if (!authToken || !user) {
        setError("Invalid authentication response. Please restart login.");
        return;
      }

      if (String(user.userStatus || "").toLowerCase() !== "active") {
        setError("This account is not active.");
        return;
      }

      const normalizedUser = {
        userId: user.userid || user.empId,
        empId: user.empId,
        email: user.userEmail || emailAddress,
        firstname: user.firstName || "",
        lastname: user.lastName || "",
        fullName: user.fullName || "",
        providerId: emailAddress,
        userLevel: user.userLevel,
        userStatus: user.userStatus,
        authToken,
      };

      localStorage.setItem("authToken", authToken);
      localStorage.setItem("tokenType", tokenType);
      localStorage.setItem("user", JSON.stringify(user));

      UserService.loginUser(normalizedUser);

      clearPendingOtpStorage();

      navigate("/Home", { replace: true });
    } catch (err) {
      console.error("OTP verification error:", err);
      setError("Verification failed. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleBackToLogin = () => {
    clearPendingOtpStorage();
    navigate("/OauthLogin", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-[#061326] via-[#0b2c5f] to-[#3b63c4]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="w-72 h-72 bg-[#00a1c9]/20 rounded-full blur-3xl absolute -top-20 -left-16" />
        <div className="w-72 h-72 bg-[#00a1c9]/10 rounded-full blur-3xl absolute bottom-0 right-0" />
      </div>

      <div className="relative w-full max-w-sm bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-8 py-9 shadow-2xl">
        <h2 className="text-2xl font-semibold text-white mb-2 text-center">
          Verify OTP
        </h2>

        <p className="text-sm text-white/80 text-center mb-6">
          Enter the one-time code sent to
          <br />
          <span className="font-medium">
            {emailAddress || "your Callmax email"}
          </span>
        </p>

        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={enteredOtp}
          disabled={isVerifying}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, "").slice(0, 6);
            setEnteredOtp(value);
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isVerifying) {
              handleVerifyOtp();
            }
          }}
          placeholder="● ● ● ● ● ●"
          className="w-full bg-white/15 border border-white/30 rounded-lg px-3 py-3 text-center text-xl tracking-widest text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#00a1c9] disabled:opacity-60"
        />

        {error && (
          <p className="text-red-400 text-xs mt-3 text-center">{error}</p>
        )}

        <button
          onClick={handleVerifyOtp}
          disabled={isVerifying}
          className={`w-full mt-6 py-2.5 rounded-lg text-sm font-medium text-white transition ${
            isVerifying
              ? "bg-white/40 cursor-not-allowed"
              : "bg-[#00a1c9] hover:bg-[#0084a4]"
          }`}
        >
          {isVerifying ? "Verifying…" : "Verify OTP"}
        </button>

        <button
          type="button"
          onClick={handleBackToLogin}
          disabled={isVerifying}
          className="w-full mt-3 py-2 text-xs text-white/70 hover:text-white transition disabled:opacity-60"
        >
          Back to login
        </button>

        <p className="text-[11px] text-white/60 mt-6 text-center">
          This OTP will expire in 3 minutes.
        </p>
      </div>

      <div className="absolute bottom-6 text-center text-[10px] text-white/70">
        <p>© 2026 CMX FinalPay Desk v{APP_VERSION}</p>
        <p>DREAM Dev Ops || Callmax Solutions International</p>
      </div>
    </div>
  );
};

export default OtpVerification;
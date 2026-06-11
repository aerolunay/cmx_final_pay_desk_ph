import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import cmxLogo from "../../assets/callmax_cover_removebg.png";
import cmxLogoDark from "../../assets/cmxlogo-removebg-preview.png";
import phFlag from "../../assets/phFlag.png";
import UserService from "../../service/UserService";
import pkg from "../../../package.json";

const AppHeader = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  const APP_VERSION = pkg.version;

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const currentUser = UserService.getCurrentUser?.() || {};

  const {
    firstname,
    lastname,
    fullName,
    email,
    userLevel,
    userStatus,
  } = currentUser;

  const normalizedRole = String(userLevel || "")
    .trim()
    .toLowerCase();

  const isAllowedAdmin = useMemo(() => {
    return ["dev", "accounting admin"].includes(normalizedRole);
  }, [normalizedRole]);

  const userName =
    fullName ||
    (firstname && lastname && `${firstname} ${lastname}`) ||
    firstname ||
    lastname ||
    email ||
    "User";

  const initials = useMemo(() => {
    const firstInitial =
      firstname?.charAt(0) ||
      fullName?.split(" ")?.[0]?.charAt(0) ||
      email?.charAt(0) ||
      "";

    const lastInitial =
      lastname?.charAt(0) ||
      fullName?.split(" ")?.slice(-1)?.[0]?.charAt(0) ||
      "";

    const value = `${firstInitial}${lastInitial}`.toUpperCase().trim();

    return value || "U";
  }, [firstname, lastname, fullName, email]);

  const isActive = (path) => location.pathname.startsWith(path);

  const clearAuthStorage = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("tokenType");
    localStorage.removeItem("user");

    localStorage.removeItem("pendingAuthId");
    localStorage.removeItem("pendingEmail");
    localStorage.removeItem("pendingRequestedAt");
    localStorage.removeItem("pendingExpiryAt");

    // Old insecure artifacts cleanup
    localStorage.removeItem("pendingOtpHashed");
    localStorage.removeItem("pendingUser");
  };

  const handleLogout = () => {
    try {
      UserService.logout?.();
      UserService.clearPendingUser?.();
    } catch (err) {
      console.error("Logout cleanup error:", err);
    }

    clearAuthStorage();
    setDropdownOpen(false);
    navigate("/OauthLogin", { replace: true });
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <header className="bg-[#003b5c] text-white shadow-sm">
      <div className="h-18 pr-6 flex items-center justify-between relative">
        <div className="flex items-center gap-3 py-2">
          <img
            src={cmxLogo}
            alt="Callmax Logo"
            className="h-12 object-contain"
          />

          <span className="text-2xl font-semibold tracking-tight flex items-center gap-4">
            FinalPay Desk
          </span>
        </div>

        <div className="flex items-center gap-3 py-2">
          <img
            src={phFlag}
            alt="Philippine Flag"
            className="w-8 h-6 object-cover border-2 border-white rounded-sm"
          />

          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 text-sm hover:bg-[#004a73] px-3 py-1 rounded transition"
            >
              <div className="w-7 h-7 rounded-full bg-cyan-500 flex items-center justify-center text-[11px] font-semibold">
                {initials}
              </div>

              <span className="hidden sm:inline text-white/90">
                {userName}
              </span>

              <svg
                className={`w-4 h-4 transition-transform duration-200 ${
                  dropdownOpen ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white text-gray-700 text-sm rounded-md shadow-lg z-50 overflow-hidden border border-gray-200">
                <div className="px-4 py-3 border-b bg-gray-50">
                  <div className="font-medium text-gray-800 truncate">
                    {userName}
                  </div>

                  <div className="text-[11px] text-gray-500 truncate">
                    {email || "No email"}
                  </div>

                  {userLevel && (
                    <div className="text-[11px] text-gray-500 mt-1">
                      Role: {userLevel}
                    </div>
                  )}

                  {userStatus && (
                    <div className="text-[11px] text-gray-500">
                      Status: {userStatus}
                    </div>
                  )}
                </div>

                {isAllowedAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate("/UserManagement");
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 transition"
                  >
                    Manage Users
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false);
                    setShowAbout(true);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 transition"
                >
                  About
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 transition border-t"
                >
                  Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <nav className="px-6 bg-white border-b border-gray-200">
        <div className="flex gap-4 text-xs md:text-sm py-2">
          <Link
            to="/Home"
            className={`transition-all ${
              isActive("/Home")
                ? "text-[#003b5c] font-semibold border-b-2 border-[#003b5c] scale-[1.05]"
                : "text-gray-700 hover:text-gray-900 hover:border-b-2 hover:border-gray-300"
            }`}
          >
            Home
          </Link>

          <Link
            to="/ProcessFinalPay"
            className={`transition-all ${
              isActive("/ProcessFinalPay")
                ? "text-[#003b5c] font-semibold border-b-2 border-[#003b5c] scale-[1.05]"
                : "text-gray-700 hover:text-gray-900 hover:border-b-2 hover:border-gray-300"
            }`}
          >
            Process Final Pay
          </Link>

          {isAllowedAdmin && (
            <Link
              to="/UserManagement"
              className={`transition-all ${
                isActive("/UserManagement")
                  ? "text-[#003b5c] font-semibold border-b-2 border-[#003b5c] scale-[1.05]"
                  : "text-gray-700 hover:text-gray-900 hover:border-b-2 hover:border-gray-300"
              }`}
            >
              User Management
            </Link>
          )}
        </div>
      </nav>

      {showAbout && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
          <div
            className="bg-white rounded-lg shadow-xl w-[420px] max-w-[90%]
            transform transition-all duration-300
            scale-[0.96] opacity-0 animate-[fadeIn_0.3s_ease_forwards]"
          >
            <div className="flex justify-between items-center px-5 py-4 border-b">
              <h2 className="text-lg font-semibold text-[#003b5c]">About</h2>

              <button
                type="button"
                onClick={() => setShowAbout(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 text-center space-y-4">
              <img
                src={cmxLogoDark}
                alt="Callmax Logo"
                className="h-10 mx-auto"
              />

              <div className="text-lg font-semibold text-black">
                CMX FinalPay Desk
              </div>

              <p className="text-sm text-gray-600 leading-relaxed">
                This application is part of the{" "}
                <span className="font-medium">DREAM-DEVOPS</span> ecosystem and
                is designed to ensure accuracy, consistency, and operational
                excellence across accounting processes.
              </p>

              <div className="text-sm text-gray-700 font-medium">
                Version: {APP_VERSION}
              </div>

              <div className="text-xs text-gray-500">
                © 2026 Callmax Solutions. All rights reserved.
              </div>
            </div>

            <div className="px-5 py-3 border-t flex justify-end">
              <button
                type="button"
                onClick={() => setShowAbout(false)}
                className="px-4 py-1.5 text-sm bg-[#003b5c] text-white rounded hover:bg-[#004a73] transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default AppHeader;
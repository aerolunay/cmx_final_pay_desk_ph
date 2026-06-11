// src/service/UserService.js
import { SERVER_URL } from "../components/lib/constants";

class UserService {
  static BASE_URL = SERVER_URL;

  /* =====================================================
     Auth Token
  ===================================================== */

  static getAuthToken() {
    return localStorage.getItem("authToken") || "";
  }

  static getTokenType() {
    return localStorage.getItem("tokenType") || "Bearer";
  }

  static getAuthHeader() {
    const token = this.getAuthToken();
    const tokenType = this.getTokenType();

    if (!token) return {};

    return {
      Authorization: `${tokenType} ${token}`,
    };
  }

  static getJsonAuthHeaders() {
    return {
      "Content-Type": "application/json",
      ...this.getAuthHeader(),
    };
  }

  static isAuthenticated() {
    return (
      !!localStorage.getItem("authToken") &&
      !!localStorage.getItem("userId") &&
      localStorage.getItem("sessionVerified") === "1"
    );
  }

  /* =====================================================
     Pending OTP User / Session
     Old pendingUser kept only for cleanup compatibility.
  ===================================================== */

  static setPendingUser(user) {
    if (user) {
      localStorage.setItem("pendingUser", JSON.stringify(user));
    }
  }

  static getPendingUser() {
    const raw = localStorage.getItem("pendingUser");

    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  static clearPendingUser() {
    localStorage.removeItem("pendingUser");
    localStorage.removeItem("pendingOtpHashed");
    localStorage.removeItem("pendingAuthId");
    localStorage.removeItem("pendingEmail");
    localStorage.removeItem("pendingRequestedAt");
    localStorage.removeItem("pendingExpiryAt");
  }

  /* =====================================================
     Login / Current User
  ===================================================== */

  static loginUser({
    empId = "",
    userId = "",
    email = "",
    firstname = "",
    lastname = "",
    fullName = "",
    providerId = "",
    userLevel = "",
    userStatus = "",
    authToken = "",
    tokenType = "Bearer",
  }) {
    const finalId = userId || empId || (email ? `manual_${email}` : "");

    if (!finalId) {
      console.warn("loginUser called without a valid userId/email");
    }

    const normalizedUser = {
      empId: empId || "",
      userId: finalId || "",
      email: email || "",
      firstname: firstname || "",
      lastname: lastname || "",
      fullName: fullName || "",
      providerId: providerId || email || "",
      userLevel: userLevel || "",
      userStatus: userStatus || "",
    };

    localStorage.setItem("empId", normalizedUser.empId);
    localStorage.setItem("userId", normalizedUser.userId);
    localStorage.setItem("userEmail", normalizedUser.email);
    localStorage.setItem("userFirstname", normalizedUser.firstname);
    localStorage.setItem("userLastname", normalizedUser.lastname);
    localStorage.setItem("userFullName", normalizedUser.fullName);

    localStorage.setItem("user_access_level", normalizedUser.userLevel);
    localStorage.setItem("user_status", normalizedUser.userStatus);

    localStorage.setItem("sessionVerified", "1");

    if (authToken) {
      localStorage.setItem("authToken", authToken);
      localStorage.setItem("tokenType", tokenType || "Bearer");
    }

    localStorage.setItem("currentUser", JSON.stringify(normalizedUser));

    /*
      Keep this too because some updated components may read localStorage.user
      from the OTP response.
    */
    localStorage.setItem(
      "user",
      JSON.stringify({
        empId: normalizedUser.empId,
        userid: normalizedUser.userId,
        userEmail: normalizedUser.email,
        firstName: normalizedUser.firstname,
        lastName: normalizedUser.lastname,
        fullName: normalizedUser.fullName,
        userLevel: normalizedUser.userLevel,
        userStatus: normalizedUser.userStatus,
      })
    );

    this.clearPendingUser();

    return finalId;
  }

  static getCurrentUser() {
    const rawCurrentUser = localStorage.getItem("currentUser");
    const rawUser = localStorage.getItem("user");

    let parsedCurrentUser = null;
    let parsedUser = null;

    try {
      parsedCurrentUser = rawCurrentUser ? JSON.parse(rawCurrentUser) : null;
    } catch {
      parsedCurrentUser = null;
    }

    try {
      parsedUser = rawUser ? JSON.parse(rawUser) : null;
    } catch {
      parsedUser = null;
    }

    const empId =
      parsedCurrentUser?.empId ||
      parsedUser?.empId ||
      localStorage.getItem("empId") ||
      "";

    const userId =
      parsedCurrentUser?.userId ||
      parsedUser?.userid ||
      localStorage.getItem("userId") ||
      "";

    const email =
      parsedCurrentUser?.email ||
      parsedUser?.userEmail ||
      localStorage.getItem("userEmail") ||
      "";

    const firstname =
      parsedCurrentUser?.firstname ||
      parsedUser?.firstName ||
      localStorage.getItem("userFirstname") ||
      "";

    const lastname =
      parsedCurrentUser?.lastname ||
      parsedUser?.lastName ||
      localStorage.getItem("userLastname") ||
      "";

    const fullName =
      parsedCurrentUser?.fullName ||
      parsedUser?.fullName ||
      localStorage.getItem("userFullName") ||
      [firstname, lastname].filter(Boolean).join(" ") ||
      "";

    const userLevel =
      parsedCurrentUser?.userLevel ||
      parsedUser?.userLevel ||
      localStorage.getItem("user_access_level") ||
      "";

    const userStatus =
      parsedCurrentUser?.userStatus ||
      parsedUser?.userStatus ||
      localStorage.getItem("user_status") ||
      "";

    return {
      empId,
      userId,
      email,
      firstname,
      lastname,
      fullName,
      userLevel,
      userStatus,

      /*
        Backward-compatible names.
      */
      user_access_level: userLevel,
      user_status: userStatus,
    };
  }

  static logout() {
    localStorage.removeItem("authToken");
    localStorage.removeItem("tokenType");

    localStorage.removeItem("empId");
    localStorage.removeItem("userId");
    localStorage.removeItem("sessionVerified");

    localStorage.removeItem("userEmail");
    localStorage.removeItem("userFirstname");
    localStorage.removeItem("userLastname");
    localStorage.removeItem("userFullName");

    localStorage.removeItem("user_access_level");
    localStorage.removeItem("user_status");

    localStorage.removeItem("currentUser");
    localStorage.removeItem("user");

    this.clearPendingUser();
  }

  /* =====================================================
     Role Helpers
  ===================================================== */

  static user_access_level() {
    const currentUser = this.getCurrentUser();
    return currentUser.userLevel || "";
  }

  static normalizeRole(role) {
    return String(role || "").trim().toLowerCase();
  }

  static hasRole(...allowedRoles) {
    const currentRole = this.normalizeRole(this.user_access_level());

    return allowedRoles
      .map((role) => this.normalizeRole(role))
      .includes(currentRole);
  }

  static getSuperAdminRole() {
    return this.hasRole("Dev", "Accounting Admin");
  }

  static canManageUsers() {
    return this.hasRole("Dev", "Accounting Admin");
  }

  static canAccessPayroll() {
    return this.hasRole("Dev", "Accounting Admin");
  }

  /* =====================================================
     Optional Authenticated Fetch Helpers
  ===================================================== */

  static async authFetch(url, options = {}) {
    const headers = {
      ...(options.headers || {}),
      ...this.getAuthHeader(),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.logout();
      window.location.href = "/OauthLogin";
      return response;
    }

    return response;
  }

  static async authJsonFetch(url, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...this.getAuthHeader(),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.logout();
      window.location.href = "/OauthLogin";
      return response;
    }

    return response;
  }
}

export default UserService;
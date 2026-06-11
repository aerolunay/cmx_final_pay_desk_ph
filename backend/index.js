require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const db = require("./config/dbconfig");

const finalPayExcelRoutes = require("./routes/finalPayExcel.js");
const uploadFinalPayRoutes = require("./routes/uploadFinalPay");

const app = express();

const PORT = Number(process.env.SERVER_PORT) || 5012;
const NODE_ENV = process.env.NODE_ENV || "development";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://fpdesk.cmxph.com";

const AUTH_SECRET =
  process.env.AUTH_SECRET ||
  process.env.SESSION_SECRET ||
  process.env.JWT_SECRET ||
  "";

const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 3);
const AUTH_TOKEN_HOURS = Number(process.env.AUTH_TOKEN_HOURS || 8);

if (!AUTH_SECRET || AUTH_SECRET.length < 32) {
  console.warn(
    "⚠️ AUTH_SECRET / SESSION_SECRET / JWT_SECRET is missing or too short. Use at least 32 random characters in production."
  );
}

/* =====================================================
   Security Headers
===================================================== */

try {
  const helmet = require("helmet");

  app.use(
    helmet({
      frameguard: { action: "deny" },
      noSniff: true,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      crossOriginOpenerPolicy: { policy: "same-origin" },
      crossOriginResourcePolicy: { policy: "same-origin" },
      contentSecurityPolicy:
        NODE_ENV === "production"
          ? {
              useDefaults: true,
              directives: {
                "default-src": ["'self'"],
                "script-src": ["'self'"],
                "style-src": ["'self'", "'unsafe-inline'"],
                "img-src": ["'self'", "data:", "blob:"],
                "connect-src": ["'self'", FRONTEND_URL],
                "frame-ancestors": ["'none'"],
              },
            }
          : false,
      hsts:
        NODE_ENV === "production"
          ? {
              maxAge: 31536000,
              includeSubDomains: true,
              preload: true,
            }
          : false,
    })
  );
} catch {
  console.warn("ℹ️ helmet is not installed. Recommended: npm install helmet");
}

/* =====================================================
   Basic Middleware
===================================================== */

app.set("trust proxy", 1);

app.use(express.json({ limit: "1mb" }));

const allowedOrigins = Array.from(
  new Set(
    [
      "http://localhost:3000",
      "https://fpdesk.cmxph.com",
      FRONTEND_URL,
    ].filter(Boolean)
  )
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/* =====================================================
   Lightweight Rate Limiter
   Recommended later: express-rate-limit + Redis store.
===================================================== */

const rateBuckets = new Map();

function rateLimit({ windowMs, max, keyPrefix }) {
  return (req, res, next) => {
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      "unknown";

    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

    const bucket = rateBuckets.get(key) || {
      count: 0,
      resetAt: now + windowMs,
    };

    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    rateBuckets.set(key, bucket);

    if (bucket.count > max) {
      return res.status(429).json({
        success: false,
        error: "Too many requests. Please try again later.",
      });
    }

    next();
  };
}

const generalLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 300,
  keyPrefix: "general",
});

const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  keyPrefix: "auth",
});

app.use(generalLimiter);

/* =====================================================
   Helpers
===================================================== */

function canonicalizeEmail(raw) {
  if (!raw) return "";

  let email = String(raw).trim().toLowerCase();
  const at = email.indexOf("@");

  if (at === -1) return email;

  let local = email.slice(0, at);
  let domain = email.slice(at + 1);

  if (domain === "googlemail.com") domain = "gmail.com";

  if (domain === "gmail.com") {
    local = local.split("+")[0].replace(/\./g, "");
  }

  return `${local}@${domain}`;
}

function safeError(res, message = "Request failed.") {
  return res.status(500).json({
    success: false,
    error: message,
  });
}

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function hasRole(userLevel, allowedRoles) {
  const normalizedUserRole = normalizeRole(userLevel);
  return allowedRoles.map(normalizeRole).includes(normalizedUserRole);
}

function base64url(input) {
  return Buffer.from(JSON.stringify(input)).toString("base64url");
}

function signPayload(header, payload) {
  return crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
}

function createAuthToken(user) {
  if (!AUTH_SECRET) {
    throw new Error("AUTH_SECRET is not configured");
  }

  const header = base64url({
    alg: "HS256",
    typ: "JWT",
  });

  const now = Math.floor(Date.now() / 1000);

  const payload = base64url({
    empId: user.empId,
    email: user.user_email,
    fullName: user.user_full_name,
    userLevel: user.user_access_level,
    iat: now,
    exp: now + AUTH_TOKEN_HOURS * 60 * 60,
  });

  const signature = signPayload(header, payload);

  return `${header}.${payload}.${signature}`;
}

function verifyAuthToken(token) {
  if (!AUTH_SECRET) return null;

  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;

  let headerParsed;

  try {
    headerParsed = JSON.parse(Buffer.from(header, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (headerParsed.alg !== "HS256" || headerParsed.typ !== "JWT") {
    return null;
  }

  const expectedSignature = signPayload(header, payload);

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  let parsed;

  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);

  if (!parsed.exp || parsed.exp < now) return null;
  if (!parsed.email || !parsed.userLevel) return null;

  return parsed;
}

function sanitizeUser(user) {
  return {
    empId: user.empId,
    userid: user.user_email,
    userEmail: user.user_email,
    lastName: user.user_last_name,
    firstName: user.user_first_name,
    fullName: user.user_full_name,
    userLevel: user.user_access_level,
    userStatus: user.user_status,
  };
}

async function getActiveUserByEmail(email) {
  const normalizedEmail = canonicalizeEmail(email);

  const [rows] = await db.execute(
    `
      SELECT
        empId,
        user_email,
        user_last_name,
        user_first_name,
        user_full_name,
        user_access_level,
        user_status
      FROM 0000_cmx_appdata_appusers.db_cmx_appusers_finalpaydesk_ph
      WHERE LOWER(user_email) = ?
      LIMIT 1
    `,
    [normalizedEmail]
  );

  if (!rows.length) return null;

  const user = rows[0];

  if (String(user.user_status || "").toLowerCase() !== "active") {
    return null;
  }

  return user;
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) return "";

  return authHeader.slice("Bearer ".length).trim();
}

async function requireAuth(req, res, next) {
  try {
    const token = getBearerToken(req);
    const tokenUser = verifyAuthToken(token);

    if (!tokenUser) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized.",
      });
    }

    /*
      Re-check active user and latest role from DB.
      This prevents stale tokens from keeping old privileges after role/status change.
    */
    const activeUser = await getActiveUserByEmail(tokenUser.email);

    if (!activeUser) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized.",
      });
    }

    req.user = {
      empId: activeUser.empId,
      email: activeUser.user_email,
      fullName: activeUser.user_full_name,
      userLevel: activeUser.user_access_level,
      userStatus: activeUser.user_status,
    };

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);

    return res.status(401).json({
      success: false,
      error: "Unauthorized.",
    });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized.",
      });
    }

    if (!hasRole(req.user.userLevel, allowedRoles)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden.",
      });
    }

    next();
  };
}

const adminAccess = [
  requireAuth,
  requireRole("Dev", "Accounting Admin"),
];

const payrollReadAccess = [
  requireAuth,
  requireRole("Dev", "Accounting Admin"),
];

const payrollWriteAccess = [
  requireAuth,
  requireRole("Dev", "Accounting Admin"),
];

const payrollUploadAccess = [
  requireAuth,
  requireRole("Dev", "Accounting Admin"),
];

/* =====================================================
   OTP Storage
   For multi-server production, move this to Redis.
===================================================== */

const otpStore = new Map();

function cleanupExpiredOtps() {
  const now = Date.now();

  for (const [pendingAuthId, record] of otpStore.entries()) {
    if (record.expiresAt <= now) {
      otpStore.delete(pendingAuthId);
    }
  }
}

setInterval(cleanupExpiredOtps, 60 * 1000).unref();

/* =====================================================
   Nodemailer
===================================================== */

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "email-smtp.us-east-1.amazonaws.com",
  port: Number(process.env.EMAIL_PORT || 587),
  secure: String(process.env.EMAIL_SECURE || "").toLowerCase() === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: NODE_ENV === "production",
  },
});

async function createOtpChallenge(emailAddress) {
  const user = await getActiveUserByEmail(emailAddress);
  const pendingAuthId = crypto.randomUUID();

  /*
    Avoid user enumeration:
    - Always return a pendingAuthId.
    - Only store/send OTP if user is valid and active.
  */
  if (!user) {
    return {
      pendingAuthId,
      user: null,
      otpSent: false,
    };
  }

  const otpPlain = String(crypto.randomInt(100000, 1000000));
  const otpHashed = await bcrypt.hash(otpPlain, 10);

  otpStore.set(pendingAuthId, {
    email: canonicalizeEmail(emailAddress),
    otpHashed,
    expiresAt: Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
    attempts: 0,
    maxAttempts: 5,
  });

  await transporter.sendMail({
    from: process.env.OTP_FROM_EMAIL || "noreply@callmaxsolutions.com",
    to: user.user_email,
    subject: "One-Time Password (OTP) - CMX FinalPay Desk",
    html: `
      <p>Hi,</p>
      <p>Your One-Time Password (OTP) is:</p>
      <h2>${otpPlain}</h2>
      <p>This OTP will expire in <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.</p>
      <p>Please do not share your OTP.</p>
      <p>If you did not request this code, please report it to dream-devops@callmaxsolutions.com.</p>
      <hr>
      <p><strong>Confidentiality & Data Privacy</strong></p>
      <p>This email is confidential and intended only for the specified recipient.</p>
    `,
  });

  return {
    pendingAuthId,
    user,
    otpSent: true,
  };
}

/* =====================================================
   Health
===================================================== */

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "fpdesk-node",
    port: PORT,
    env: NODE_ENV,
  });
});

/* =====================================================
   Authentication
===================================================== */

app.post("/api/check-email", authLimiter, async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      error: "Email is required.",
    });
  }

  try {
    const result = await createOtpChallenge(email);

    return res.json({
      success: true,
      pendingAuthId: result.pendingAuthId,
      message: "If the email is registered and active, an OTP has been sent.",
    });
  } catch (err) {
    console.error("Check email / OTP error:", err);

    return res.status(200).json({
      success: true,
      pendingAuthId: crypto.randomUUID(),
      message: "If the email is registered and active, an OTP has been sent.",
    });
  }
});

/*
  Backward-compatible route.
  This replaces the old risky behavior that returned otpHashed to the client.
*/
app.post("/sendOTP", authLimiter, async (req, res) => {
  const { emailAddress } = req.body;

  if (!emailAddress) {
    return res.status(400).json({
      success: false,
      message: "Email address is required.",
    });
  }

  try {
    const result = await createOtpChallenge(emailAddress);

    return res.status(200).json({
      success: true,
      pendingAuthId: result.pendingAuthId,
      message: "If the email is registered and active, an OTP has been sent.",
    });
  } catch (error) {
    console.error("Error in /sendOTP:", error);

    return res.status(200).json({
      success: true,
      pendingAuthId: crypto.randomUUID(),
      message: "If the email is registered and active, an OTP has been sent.",
    });
  }
});

app.post("/api/verify-otp", authLimiter, async (req, res) => {
  const { pendingAuthId, otp } = req.body;

  if (!pendingAuthId || !otp) {
    return res.status(400).json({
      success: false,
      error: "Invalid authentication request.",
    });
  }

  if (!/^\d{6}$/.test(String(otp).trim())) {
    return res.status(400).json({
      success: false,
      error: "Invalid authentication request.",
    });
  }

  const record = otpStore.get(pendingAuthId);

  if (!record) {
    return res.status(401).json({
      success: false,
      error: "Invalid or expired OTP.",
    });
  }

  if (record.expiresAt <= Date.now()) {
    otpStore.delete(pendingAuthId);

    return res.status(401).json({
      success: false,
      error: "Invalid or expired OTP.",
    });
  }

  record.attempts += 1;

  if (record.attempts > record.maxAttempts) {
    otpStore.delete(pendingAuthId);

    return res.status(429).json({
      success: false,
      error: "Too many OTP attempts. Please request a new OTP.",
    });
  }

  const isValidOtp = await bcrypt.compare(String(otp).trim(), record.otpHashed);

  if (!isValidOtp) {
    return res.status(401).json({
      success: false,
      error: "Invalid or expired OTP.",
    });
  }

  const user = await getActiveUserByEmail(record.email);

  otpStore.delete(pendingAuthId);

  if (!user) {
    return res.status(401).json({
      success: false,
      error: "Invalid authentication request.",
    });
  }

  const authToken = createAuthToken(user);

  return res.json({
    success: true,
    authToken,
    tokenType: "Bearer",
    expiresInHours: AUTH_TOKEN_HOURS,
    user: sanitizeUser(user),
  });
});

app.get("/api/me", requireAuth, async (req, res) => {
  try {
    const user = await getActiveUserByEmail(req.user.email);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized.",
      });
    }

    return res.json({
      success: true,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error("Me endpoint error:", err);
    return safeError(res, "Unable to load user session.");
  }
});

/* =====================================================
   Final Pay Excel Export
===================================================== */

app.use("/api/finalpay", payrollReadAccess, finalPayExcelRoutes);

/* =====================================================
   User Management
===================================================== */

app.get("/api/getAppUsers", adminAccess, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `
        SELECT
          empId,
          user_email,
          user_last_name,
          user_first_name,
          user_full_name,
          user_access_level,
          user_status,
          user_registration_date
        FROM 0000_cmx_appdata_appusers.db_cmx_appusers_finalpaydesk_ph
      `
    );

    return res.json({
      success: true,
      data: rows,
    });
  } catch (err) {
    console.error("FinalPay Desk users DB error:", err);
    return safeError(res, "Failed to load FinalPay Desk users.");
  }
});

app.post("/api/addAppUser", adminAccess, async (req, res) => {
  const {
    empId,
    user_email,
    user_first_name,
    user_last_name,
    user_access_level,
  } = req.body;

  if (
    !empId ||
    !user_email ||
    !user_first_name ||
    !user_last_name ||
    !user_access_level
  ) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields.",
    });
  }

  const allowedLevels = new Set([
    "Admin",
    "Super Admin",
    "HR",
    "Payroll",
    "Finance",
    "Viewer",
  ]);

  if (!allowedLevels.has(user_access_level)) {
    return res.status(400).json({
      success: false,
      error: "Invalid access level.",
    });
  }

  const user_full_name = `${String(user_first_name).trim()} ${String(
    user_last_name
  ).trim()}`;

  const user_status = "Active";

  try {
    const sql = `
      INSERT INTO 0000_cmx_appdata_appusers.db_cmx_appusers_finalpaydesk_ph
      (
        empId,
        user_email,
        user_last_name,
        user_first_name,
        user_full_name,
        user_access_level,
        user_status,
        user_registration_date
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE())
    `;

    await db.execute(sql, [
      empId,
      canonicalizeEmail(user_email),
      String(user_last_name).trim(),
      String(user_first_name).trim(),
      user_full_name,
      user_access_level,
      user_status,
    ]);

    return res.json({
      success: true,
      message: "User added successfully.",
    });
  } catch (err) {
    console.error("Add user error:", err);

    return res.status(500).json({
      success: false,
      error: "Failed to add user.",
    });
  }
});

app.post("/api/updateAppUser", adminAccess, async (req, res) => {
  const { empId, user_access_level, user_status } = req.body;

  if (!empId || !user_access_level || !user_status) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields.",
    });
  }

  const allowedLevels = new Set([
    "Admin",
    "Super Admin",
    "HR",
    "Payroll",
    "Finance",
    "Viewer",
  ]);

  const allowedStatuses = new Set(["Active", "Inactive"]);

  if (!allowedLevels.has(user_access_level)) {
    return res.status(400).json({
      success: false,
      error: "Invalid access level.",
    });
  }

  if (!allowedStatuses.has(user_status)) {
    return res.status(400).json({
      success: false,
      error: "Invalid user status.",
    });
  }

  try {
    const sql = `
      UPDATE 0000_cmx_appdata_appusers.db_cmx_appusers_finalpaydesk_ph
      SET
        user_access_level = ?,
        user_status = ?
      WHERE empId = ?
    `;

    const [result] = await db.execute(sql, [
      user_access_level,
      user_status,
      empId,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found.",
      });
    }

    return res.json({
      success: true,
      message: "User updated successfully.",
    });
  } catch (err) {
    console.error("Update user error:", err);

    return res.status(500).json({
      success: false,
      error: "Failed to update user.",
    });
  }
});

/* =====================================================
   Final Pay Data
===================================================== */

app.get("/api/finalPayData", payrollReadAccess, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `
        SELECT *
        FROM 2001_cmx_appdata_finalpay_database.db_cmx_finalpay_data
      `
    );

    return res.json({
      success: true,
      data: rows,
    });
  } catch (err) {
    console.error("Final Pay DB error:", err);

    return safeError(res, "Failed to load Final Pay data.");
  }
});

app.get("/api/ytdPayrollData", payrollReadAccess, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `
        SELECT *
        FROM 2001_cmx_appdata_finalpay_database.db_cmx_finalpay_payroll_data
      `
    );

    return res.json({
      success: true,
      data: rows,
    });
  } catch (err) {
    console.error("Payroll Data DB error:", err);

    return safeError(res, "Failed to load payroll data.");
  }
});

app.get("/api/latest-upload-date", payrollReadAccess, async (req, res) => {
  try {
    const [rows] = await db.query(
      `
        SELECT upload_date
        FROM 2001_cmx_appdata_finalpay_database.db_cmx_finalpay_payroll_data
        ORDER BY upload_date DESC
        LIMIT 1
      `
    );

    return res.json({
      success: true,
      lastUploadDate: rows?.[0]?.upload_date || null,
    });
  } catch (error) {
    console.error("Error fetching latest upload date:", error);

    return safeError(res, "Failed to fetch latest upload date.");
  }
});

/* =====================================================
   Payroll Upload
===================================================== */

app.use("/api", payrollUploadAccess, uploadFinalPayRoutes);

/* =====================================================
   Employee Lookup
===================================================== */

app.get("/api/employees", payrollReadAccess, async (req, res) => {
  try {
    const [employees] = await db.query(
      `
        SELECT
          EMPLOYEEID AS employeeId,
          CONCAT(LASTNAME, ", ", FIRSTNAME) AS employee_name,
          POSITION,
          L1_MANAGER_ID AS supervisorId,
          L1_MANAGER_NAME AS supervisorName,
          ACCOUNT AS account,
          BIRTHDAY AS dob,
          HIREDATE,
          SEPARATIONDATE,
          TIN,
          BANKACCT,
          CONTACTNO,
          ADDRESS,
          BASICPAY,
          SKILLSALLOWANCE,
          ND
        FROM 0001_cmx_appdata_employeeroster.db_cmxph_employee_roster
        WHERE FULLNAME IS NOT NULL
          AND EMPLOYEEID NOT IN (
            SELECT empID
            FROM 2001_cmx_appdata_finalpay_database.db_cmx_finalpay_data
          )
        ORDER BY FULLNAME ASC
      `
    );

    return res.status(200).json({
      success: true,
      data: employees,
    });
  } catch (error) {
    console.error("Error fetching employees:", error);

    return safeError(res, "Failed to fetch employees.");
  }
});

/* =====================================================
   Save Final Pay
===================================================== */

app.post("/api/saveFinalPay", payrollWriteAccess, async (req, res) => {
  try {
    const data = req.body;

    if (!data || !data.empID || !data.Name) {
      return res.status(400).json({
        success: false,
        error: "Missing required final pay fields.",
      });
    }

    const toMySQLDate = (input) => {
      const date = new Date(input);
      return isNaN(date) ? null : date.toISOString().split("T")[0];
    };

    const toMySQLDateTime = (input) => {
      const date = new Date(input);
      return isNaN(date)
        ? null
        : date.toISOString().slice(0, 19).replace("T", " ");
    };

    const cleanNumber = (value) => {
      if (value === null || value === undefined || value === "") return 0;

      const num = Number(
        String(value)
          .replace(/[₱,%]/g, "")
          .replace(/,/g, "")
          .trim()
      );

      return isNaN(num) ? 0 : num;
    };

    const sql = `
      INSERT INTO 2001_cmx_appdata_finalpay_database.db_cmx_finalpay_data (
        empID,
        Name,
        position,
        tin,
        address,
        birthday,
        monthly_rate,
        daily_rate,
        bank_account_number,
        date_hired,
        last_payout_cutoff,
        date_resigned,
        unpaid_work_days,
        unpaid_slvl_days,
        ndiff_pct,
        skills_allowance,
        holiday_days,
        sl_remaining_days,
        remaining_basic_pay,
        remaining_vl_pay,
        ndiff_amount,
        skills_allowance_amount,
        holiday_pay_amount,
        adjustment_amount,
        others,
        other_due_to_employee,
        sl_remaining,
        other_accountabilities,
        outstanding_company_loans,
        thirteenth_month_partial,
        ytd_gross_compensation,
        less_non_taxable_comp,
        thirteenth_month_capped,
        thirteenth_month_total,
        sss_phic_hdmf,
        other_non_tax_compensation,
        net_taxable_income,
        tax_due,
        total_withholding_tax_deductions,
        tax_due_refund,
        total_final_pay,
        processed_by,
        processed_date,
        year,
        contact,
        dob,
        total_skills_allowance
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `;

    const values = [
      data.empID,
      data.Name,
      data.position,
      data.tin,
      data.address,
      data.birthday,
      cleanNumber(data.monthly_rate),
      cleanNumber(data.daily_rate),
      data.bank_account_number,
      toMySQLDate(data.date_hired),
      toMySQLDate(data.last_payout_cutoff),
      toMySQLDate(data.date_resigned),
      cleanNumber(data.unpaid_work_days),
      cleanNumber(data.unpaid_slvl_days),
      cleanNumber(data.ndiff_pct),
      cleanNumber(data.skills_allowance),
      cleanNumber(data.holiday_days),
      cleanNumber(data.sl_remaining_days),
      cleanNumber(data.remaining_basic_pay),
      cleanNumber(data.remaining_vl_pay),
      cleanNumber(data.ndiff_amount),
      cleanNumber(data.skills_allowance_amount),
      cleanNumber(data.holiday_pay_amount),
      cleanNumber(data.adjustment_amount),
      cleanNumber(data.others),
      cleanNumber(data.other_due_to_employee),
      cleanNumber(data.sl_remaining),
      cleanNumber(data.other_accountabilities),
      cleanNumber(data.outstanding_company_loans),
      cleanNumber(data.thirteenth_month_partial),
      cleanNumber(data.ytd_gross_compensation),
      cleanNumber(data.less_non_taxable_comp),
      cleanNumber(data.thirteenth_month_capped),
      cleanNumber(data.thirteenth_month_total),
      cleanNumber(data.sss_phic_hdmf),
      cleanNumber(data.other_non_tax_compensation),
      cleanNumber(data.net_taxable_income),
      cleanNumber(data.tax_due),
      cleanNumber(data.total_withholding_tax_deductions),
      cleanNumber(data.tax_due_refund),
      cleanNumber(data.total_final_pay),
      data.processed_by || req.user.fullName || req.user.email,
      toMySQLDateTime(data.processed_date || new Date()),
      data.year,
      data.contact,
      toMySQLDate(data.dob),
      cleanNumber(data.skills_allowance_total || data.total_skills_allowance),
    ];

    const cleaned = values.map((v) => (v === undefined ? null : v));

    await db.execute(sql, cleaned);

    return res.status(200).json({
      success: true,
      message: "Final pay record inserted successfully.",
    });
  } catch (err) {
    console.error("Error saving final pay data:", err);

    return res.status(500).json({
      success: false,
      error: "Failed to save final pay data.",
    });
  }
});

/* =====================================================
   404
===================================================== */

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    error: "Route not found.",
  });
});

/* =====================================================
   Error Handler
===================================================== */

app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      error: "Origin not allowed.",
    });
  }

  return res.status(500).json({
    success: false,
    error: "Internal server error.",
  });
});

/* =====================================================
   Start Server
===================================================== */

app.listen(PORT, () => {
  console.log(`FPDesk Node server running on port ${PORT}`);
});
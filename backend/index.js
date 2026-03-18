require("dotenv").config();

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const AWS = require("aws-sdk");
const bcrypt = require("bcrypt");
const db = require("./config/dbconfig");
const multer = require("multer");
const fs = require("fs");

const upload = multer({ storage: multer.memoryStorage() });
const s3 = new AWS.S3();

const finalPayExcelRoutes = require("./routes/finalPayExcel.js");

const FRONTEND_URL = process.env.FRONTEND_URL;


AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Nodemailer (SES)
const transporter = nodemailer.createTransport({
  host: "email-smtp.us-east-1.amazonaws.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

const app = express();

const PORT = Number(process.env.SERVER_PORT) || 5012;

// Middleware
app.use(express.json());

app.use(
  cors({
    origin: ["http://localhost:3000",  "https://fpdesk.cmxph.com"],
    credentials: true,
  })
);

app.set("trust proxy", 1);

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "fpdesk-node",
    port: PORT,
    env: process.env.NODE_ENV,
  });
});



app.use("/api/finalpay", finalPayExcelRoutes);



// ---------- User management ----------
// get all users
app.get("/api/getAppUsers", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `
      SELECT * FROM 0000_cmx_appdata_appusers.db_cmx_appusers_finalpaydesk_ph
      `
    );

    return res.json({
      success: true,
      data: rows,
    });
  } catch (err) {
    console.error("FinalPay Desk DB error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to load FinalPay Desk Users.",
    });
  }
});


//check email for login
app.post("/api/check-email", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      error: "Email is required",
    });
  }

  try {
    const [rows] = await db.execute(
      `SELECT empId, user_email, user_last_name, user_first_name, user_full_name, user_access_level, user_status 
       FROM 0000_cmx_appdata_appusers.db_cmx_appusers_finalpaydesk_ph 
       WHERE user_email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Email not registered",
      });
    }

    const user = rows[0];

    if (user.user_status !== "Active") {
      return res.status(403).json({
        success: false,
        error: "Inactive user",
      });
    }

    // ✅ Unified response
    return res.json({
      success: true,
      user: {
        empId: user.empId,
        userid: user.user_email,
        userEmail: user.user_email,
        lastName: user.user_last_name,
        firstName: user.user_first_name,
        fullName: user.user_full_name,
        userLevel: user.user_access_level,
        userStatus: user.user_status,
      },
    });
  } catch (err) {
    console.error("Email check DB error:", err);
    return res.status(500).json({
      success: false,
      error: "Server error",
    });
  }
});


//Add Users
app.post("/api/addAppUser", async (req, res) => {
  const {
    empId,
    user_email,
    user_first_name,
    user_last_name,
    user_access_level,
  } = req.body;

  const user_full_name = `${user_first_name} ${user_last_name}`;
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
      user_email,
      user_last_name,
      user_first_name,
      user_full_name,
      user_access_level,
      user_status,
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error("Add user error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

//Update User
app.post("/api/updateAppUser", async (req, res) => {
  const {
    empId,
    user_access_level,
    user_status,
  } = req.body;

  if (!empId || !user_access_level || !user_status) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields",
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
        error: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User updated successfully",
    });
  } catch (err) {
    console.error("Update user error:", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});



// ---------- OTP SENDING ----------
app.post("/sendOTP", async (req, res) => {
  try {
    const { emailAddress, requestedDateTime, expiryDateTime } = req.body;

    if (!emailAddress || !requestedDateTime || !expiryDateTime) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields." });
    }

    // ✅ Generate and hash OTP
    const otpPlain = String(
      Math.floor(100000 + Math.random() * 900000)
    ).padStart(6, "0");

    const salt = await bcrypt.genSalt(10);
    const otpHashed = await bcrypt.hash(otpPlain, salt);

    // ✅ Send OTP via email
    await transporter.sendMail({
      from: "noreply@callmaxsolutions.com",
      to: emailAddress,
      subject: "One-Time Password (OTP) - CMX FinalPay Desk",
      html: `
        <p>Hi,</p>
        <p>Your One-Time Password (OTP) is:</p>
        <h2>${otpPlain}</h2>
        <p>This OTP will expire in <strong>3 minutes</strong>.</p>
        <p>Please do not share your OTP.</p>
        <p>If you did not request this code and suspect invalid use, report instance to dream-devops@callmaxsolutions.com</p>
        <hr>
        <p><strong>Confidentiality & Data Privacy</strong></p>
        <p>This email and its attachments are confidential, intended only for the specified recipient(s), and may contain legally privileged information. Unauthorized review, use, disclosure, or distribution is prohibited. If you received this email by mistake, please notify the sender and delete it and its attachments from your system.</p>
        <p>Opinions expressed are the sender's own and may not reflect those of Callmax Solutions International Inc. While precautions are taken to ensure virus-free emails, we accept no liability for any resulting damage.</p>
        <p>Data Privacy: We respect your data privacy and handle personal data in compliance with applicable laws. Personal data received via email is processed for intended purposes and protected as per our privacy policies. Unauthorized use or disclosure of this email or its contents is prohibited and may be illegal.</p>
      `,
    });

    // ✅ Return hashed OTP only
    res.status(200).json({
      success: true,
      message: "OTP sent successfully.",
      otpHashed,
    });
  } catch (error) {
    console.error("Error in /sendOTP:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while sending the OTP.",
      error: error.message,
    });
  }
});



//--------------FinalPay Data----------------
app.get("/api/finalPayData", async (req, res) => {
  try {
    const [rows] = await db.execute(
      `
      SELECT * FROM 2001_cmx_appdata_finalpay_database.db_cmx_finalpay_data
      `
    );

    return res.json({
      success: true,
      data: rows,
    });
  } catch (err) {
    console.error("Final Pay DB error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to load Final Pay Data.",
    });
  }
});

// GET YTD Payroll Data
app.get('/api/ytdPayrollData', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `
      SELECT * FROM 2001_cmx_appdata_finalpay_database.db_cmx_finalpay_payroll_data
      `
    );

    return res.json({
      success: true,
      data: rows,
    });
  } catch (err) {
    console.error("Payroll Data DB error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to load Payroll Data.",
    });
  }
});


// GET /api/latest-upload-date
app.get('/api/latest-upload-date', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT upload_date 
      FROM 2001_cmx_appdata_finalpay_database.db_cmx_finalpay_payroll_data
      ORDER BY upload_date DESC
      LIMIT 1
    `);
    res.json({ lastUploadDate: rows?.[0]?.upload_date || null });
  } catch (error) {
    console.error("Error fetching last upload date:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// --------------- data upload ------------------
const uploadFinalPayRoutes = require('./routes/uploadFinalPay');
app.use('/api', uploadFinalPayRoutes);

//------------ Employee Lookup --------------
app.get("/api/employees", async (req, res) => {
  try {
    const [employees] = await db.query(
      `SELECT 
         EMPLOYEEID AS employeeId, 
         CONCAT(LASTNAME, ", ",FIRSTNAME) AS employee_name, 
         POSITION, 
         L1_MANAGER_ID as supervisorId, 
         L1_MANAGER_NAME as supervisorName, 
         ACCOUNT as account, 
         BIRTHDAY as dob, 
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
           SELECT empID FROM 2001_cmx_appdata_finalpay_database.db_cmx_finalpay_data
         )

       ORDER BY FULLNAME ASC`
    );

    if (employees.length === 0) {
      return res.status(404).json({ message: "No active employees found" });
    }

    res.status(200).json(employees);
  } catch (error) {
    console.error("❌ Error fetching employees:", error);
    res.status(500).json({ message: "Database error", error });
  }
});


app.post("/api/saveFinalPay", async (req, res) => {
  try {
    const data = req.body;

const sql = `
  INSERT INTO 2001_cmx_appdata_finalpay_database.db_cmx_finalpay_data (
    empID, Name, position, tin, address, birthday, monthly_rate, daily_rate,
    bank_account_number, date_hired, last_payout_cutoff, date_resigned,
    unpaid_work_days, unpaid_slvl_days, ndiff_pct, skills_allowance,
    holiday_days, sl_remaining_days, remaining_basic_pay, remaining_vl_pay,
    ndiff_amount, skills_allowance_amount, holiday_pay_amount, adjustment_amount,
    others, other_due_to_employee, sl_remaining, other_accountabilities,
    outstanding_company_loans, thirteenth_month_partial, ytd_gross_compensation,
    less_non_taxable_comp, thirteenth_month_capped, thirteenth_month_total, sss_phic_hdmf,
    other_non_tax_compensation, net_taxable_income, tax_due,
    total_withholding_tax_deductions, tax_due_refund, total_final_pay,
    processed_by, processed_date, year, contact, dob, total_skills_allowance
  )
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,
          ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? ,?
  )
`;

  const toMySQLDate = (input) => {
    const date = new Date(input);
    return isNaN(date) ? null : date.toISOString().split("T")[0]; // YYYY-MM-DD
  };

  const toMySQLDateTime = (input) => {
    const date = new Date(input);
    return isNaN(date) ? null : date.toISOString().slice(0, 19).replace("T", " "); // YYYY-MM-DD HH:MM:SS
  };

const cleanNumber = (value) => {
  if (value === null || value === undefined) return 0;

  const num = Number(
    String(value)
      .replace(/[₱,%]/g, "")  // Remove peso sign and percent
      .replace(/,/g, "")      // Remove thousands separator if present
      .trim()
  );

  return isNaN(num) ? 0 : num;
};

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
      data.unpaid_work_days,
      data.unpaid_slvl_days,
      cleanNumber(data.ndiff_pct),
      cleanNumber(data.skills_allowance),
      data.holiday_days,
      data.sl_remaining_days,
      data.remaining_basic_pay,
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
      data.processed_by,
      toMySQLDateTime(data.processed_date),
      data.year,
      data.contact,
      toMySQLDate(data.dob),
      cleanNumber(data.skills_allowance_total)
    ];

    // ✅ Replace undefined with null
    const cleaned = values.map((v) => (v === undefined ? null : v));

    // ✅ Execute the insert
    await db.execute(sql, cleaned);

    return res.status(200).json({
      success: true,
      message: "Final pay record inserted successfully.",
    });
  } catch (err) {
    console.error("❌ Error saving final pay data:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to save final pay data.",
    });
  }
});


// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const dayjs = require("dayjs");
const db = require("../config/dbconfig");

const router = express.Router();

/* =====================================================
   Access Control
   -----------------------------------------------------
   Defense-in-depth:
   - index.js should already mount this router behind auth.
   - This still fails closed if the route is mounted without auth.
===================================================== */

const PAYROLL_UPLOAD_ROLES = new Set([
  "dev",
  "accounting admin",
]);

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function hasPayrollUploadRole(user) {
  return PAYROLL_UPLOAD_ROLES.has(normalizeRole(user?.userLevel));
}

function requirePayrollUploadAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized.",
    });
  }

  if (!hasPayrollUploadRole(req.user)) {
    return res.status(403).json({
      success: false,
      error: "Forbidden.",
    });
  }

  next();
}

/* =====================================================
   Upload Middleware
===================================================== */

const ALLOWED_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream",
]);

const ALLOWED_EXTENSIONS = new Set([".xlsx", ".xls"]);

function getFileExtension(filename) {
  const name = String(filename || "").toLowerCase();
  const dotIndex = name.lastIndexOf(".");
  return dotIndex >= 0 ? name.slice(dotIndex) : "";
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const ext = getFileExtension(file.originalname);

    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error("INVALID_FILE_TYPE"));
    }

    if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error("INVALID_FILE_TYPE"));
    }

    cb(null, true);
  },
});

/* =====================================================
   Utilities
===================================================== */

function normalizeKey(key) {
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function cleanNumeric(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  return cleaned === "" || Number.isNaN(Number(cleaned))
    ? null
    : Number(cleaned);
}

function cleanDate(value) {
  if (!value) return null;

  /*
    Excel serial date support.
  */
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);

    if (!parsed) return null;

    const year = parsed.y;
    const month = String(parsed.m).padStart(2, "0");
    const day = String(parsed.d).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  const parsed = dayjs(
    String(value).trim(),
    ["MM/DD/YYYY", "YYYY-MM-DD", "DD/MM/YYYY", "M/D/YYYY"],
    true
  );

  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : null;
}

function isValidEmployeeId(value) {
  return /^7\d{6}$/.test(String(value || "").trim());
}

function safeString(value) {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();

  if (!text) return null;

  return text;
}

function sendUploadError(res, message, status = 400) {
  return res.status(status).json({
    success: false,
    error: message,
  });
}

/* =====================================================
   Strict Column Allowlist
   -----------------------------------------------------
   This prevents uploaded Excel headers from deciding
   arbitrary DB column names.
===================================================== */

const allowedColumnMap = {
  employee_id: "employee_id",
  emp_id: "employee_id",
  employeeid: "employee_id",

  fullname: "fullname",
  full_name: "fullname",
  name: "fullname",

  position: "position",
  department: "department",
  date_hired: "date_hired",
  employment_status: "employment_status",
  bank_account_number: "bank_account_number",
  cost_center: "cost_center",
  gender: "gender",

  work_days_per_year: "work_days_per_year",
  basic_monthly_salary: "basic_monthly_salary",
  monthly_de_minimis_benefits: "monthly_de_minimis_benefits",
  total_monthly_salary: "total_monthly_salary",
  basic_salary_semi_monthly: "basic_salary_semi_monthly",
  gross_day: "gross_day",
  basic_hr_8_hours: "basic_hr_8_hours",
  de_minimis_benefits_semi_monthly: "de_minimis_benefits_semi_monthly",
  "13th_month_nontaxable": "13th_month_nontaxable",
  allowance: "allowance",

  basic_adj: "basic_adj",
  basic_adj_1: "basic_adj_1",
  expense_account: "expense_account",
  lh_adj: "lh_adj",
  lh_adj_1: "lh_adj_1",
  lh_nd_adj: "lh_nd_adj",
  lh_nd_adj_1: "lh_nd_adj_1",
  lh_ot_adj: "lh_ot_adj",
  lh_rd_adj: "lh_rd_adj",
  lh_rd_nd_adj: "lh_rd_nd_adj",
  misc_adj: "misc_adj",
  nd_adj: "nd_adj",
  ord_nd: "ord_nd",
  ord_nd_adj: "ord_nd_adj",
  ord_nd_adj_1: "ord_nd_adj_1",
  ord_nd_ot_adj: "ord_nd_ot_adj",
  ord_ot: "ord_ot",
  ord_ot_adj: "ord_ot_adj",
  ord_ot_adj_1: "ord_ot_adj_1",
  ot_adj: "ot_adj",
  rd_adj: "rd_adj",
  rd_nd_adj: "rd_nd_adj",
  rd_nd_adj_1: "rd_nd_adj_1",
  rdot_adj: "rdot_adj",
  rdot_adj_1: "rdot_adj_1",
  sh_adj: "sh_adj",
  sh_adj_1: "sh_adj_1",
  sh_nd_adj: "sh_nd_adj",
  sh_nd_ot_adj: "sh_nd_ot_adj",
  sh_ot_adj: "sh_ot_adj",

  skill_allowance: "skill_allowance",
  skills_allowance: "skills_allowance",
  skills_allowance_adj: "skills_allowance_adj",
  skills_allownace: "skills_allownace",
  sl_adj: "sl_adj",
  sme_allowance: "sme_allowance",
  sss_return: "sss_return",
  sssee: "sssee",

  ord_nd_1: "ord_nd_1",
  ord_ndhhmm: "ord_ndhhmm",
  ord_ot_1: "ord_ot_1",
  ord_othhmm: "ord_othhmm",
  ord_nd_ot: "ord_nd_ot",
  ord_nd_othhmm: "ord_nd_othhmm",
  rd_nd: "rd_nd",
  rd_ndhhmm: "rd_ndhhmm",
  rd_ot: "rd_ot",
  rd_othhmm: "rd_othhmm",
  rd: "rd",
  rdhhmm: "rdhhmm",
  sh_nd: "sh_nd",
  sh_ndhhmm: "sh_ndhhmm",
  sh_ot: "sh_ot",
  sh_othhmm: "sh_othhmm",
  sh_nd_ot: "sh_nd_ot",
  sh_nd_othhmm: "sh_nd_othhmm",
  sh: "sh",
  shhhmm: "shhhmm",
  sh_rd: "sh_rd",
  sh_rdhhmm: "sh_rdhhmm",
  lh_nd: "lh_nd",
  lh_ndhhmm: "lh_ndhhmm",
  lh_ot: "lh_ot",
  lh_othhmm: "lh_othhmm",
  lh_nd_ot: "lh_nd_ot",
  lh_nd_othhmm: "lh_nd_othhmm",
  lh: "lh",
  lhhhhmm: "lhhhmm",
  lhhhmm: "lhhhmm",
  lh_rd_nd: "lh_rd_nd",
  lh_rd_ndhhmm: "lh_rd_ndhhmm",
  lh_rd: "lh_rd",
  lh_rdhhmm: "lh_rdhhmm",

  ot_total: "ot_total",
  total_salary: "total_salary",
  days_absent: "days_absent",
  total_absent_deduction: "total_absent_deduction",
  deminimis_absent_deduction: "deminimis_absent_deduction",
  allowance_absent_deduction: "allowance_absent_deduction",
  discretionary_deduction: "discretionary_deduction",
  minutes_late: "minutes_late",
  total_late_deduction: "total_late_deduction",

  withholding_tax: "withholding_tax",
  sss: "sss",
  philhealth: "philhealth",
  hdmf: "hdmf",
  bank_charge_less: "bank_charge_less",
  basic_adj_less: "basic_adj_less",
  basic_adj_less_1: "basic_adj_less_1",
  company_loan_less: "company_loan_less",
  company_loan_less_1: "company_loan_less_1",
  company_phone_less: "company_phone_less",
  company_phone123_less: "company_phone123_less",
  hdmf_calamity_loan_less: "hdmf_calamity_loan_less",
  hdmf_calamity_loan_less_1: "hdmf_calamity_loan_less_1",
  hdmf_loan_less: "hdmf_loan_less",
  hdmf_loan_less_1: "hdmf_loan_less_1",
  hdmf_loan_less_2: "hdmf_loan_less_2",
  hdmf_salary_loan_less: "hdmf_salary_loan_less",
  hdmfcaloan_less: "hdmfcaloan_less",
  hdmfloan_less: "hdmfloan_less",
  hdmfloan_less_1: "hdmfloan_less_1",
  hmdf_calamity_loan_less: "hmdf_calamity_loan_less",
  hmdf_calamity_loan_less_1: "hmdf_calamity_loan_less_1",
  lh_adj_less: "lh_adj_less",
  lh_nd_adj_less: "lh_nd_adj_less",
  miscellaneous_less: "miscellaneous_less",
  ord_nd_adj_less: "ord_nd_adj_less",
  ord_ot_adj_less: "ord_ot_adj_less",
  rd_adj_less: "rd_adj_less",
  rd_adj_less_1: "rd_adj_less_1",
  rd_nd_adj_less: "rd_nd_adj_less",
  rd_nd_adj_less_1: "rd_nd_adj_less_1",
  sss_calamity_loan_less: "sss_calamity_loan_less",
  sss_calamity_loan_less_1: "sss_calamity_loan_less_1",
  sss_loan_less: "sss_loan_less",
  sss_salary_loan_less: "sss_salary_loan_less",
  sss_salary_loan_less_1: "sss_salary_loan_less_1",
  sss_salary_loan__less: "sss_salary_loan__less",
  withholding_tax_less: "withholding_tax_less",
  witholding_tax_less: "witholding_tax_less",

  deductions_total: "deductions_total",
  net_pay: "net_pay",
  taxable_gross: "taxable_gross",
  tax_adj: "tax_adj",
  sssee_adj: "sssee_adj",
  ssser: "ssser",
  sssec: "sssec",
  pher: "pher",
  hdmfer: "hdmfer",
  hdmf_additional: "hdmf_additional",
};

const stringColumns = new Set([
  "employee_id",
  "fullname",
  "position",
  "department",
  "employment_status",
  "bank_account_number",
  "cost_center",
  "gender",
  "expense_account",
]);

const dateColumns = new Set(["date_hired"]);

function transformValue(dbColumn, rawValue) {
  if (dateColumns.has(dbColumn)) return cleanDate(rawValue);
  if (stringColumns.has(dbColumn)) return safeString(rawValue);

  return cleanNumeric(rawValue);
}

function buildColumnMapping(sourceKeys) {
  const mapping = {};

  for (const sourceKey of sourceKeys) {
    const normalized = normalizeKey(sourceKey);
    const dbColumn = allowedColumnMap[normalized];

    if (dbColumn) {
      mapping[sourceKey] = dbColumn;
    }
  }

  return mapping;
}

function dedupeDbColumns(mapping) {
  const seen = new Set();
  const result = {};

  for (const [sourceKey, dbColumn] of Object.entries(mapping)) {
    if (seen.has(dbColumn)) continue;

    seen.add(dbColumn);
    result[sourceKey] = dbColumn;
  }

  return result;
}

/* =====================================================
   Route
===================================================== */

router.post(
  "/uploadFinalPay",
  requirePayrollUploadAccess,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return sendUploadError(res, "No file uploaded.");
      }

      const ext = getFileExtension(req.file.originalname);

      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return sendUploadError(res, "Invalid file type.");
      }

      let workbook;

      try {
        workbook = XLSX.read(req.file.buffer, {
          type: "buffer",
          cellDates: true,
          WTF: false,
        });
      } catch (parseErr) {
        console.error("Excel parse error:", parseErr);
        return sendUploadError(res, "Unable to read Excel file.");
      }

      const sheet = workbook.Sheets["Summary"];

      if (!sheet) {
        return sendUploadError(res, "Summary sheet not found.");
      }

      const rows = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
        range: 4,
      });

      if (!rows.length) {
        return sendUploadError(res, "No data rows found.");
      }

      const filtered = rows.filter((row) => {
        const firstKey = Object.keys(row)[0];
        const empId = String(row[firstKey] || "").trim();
        return isValidEmployeeId(empId);
      });

      if (!filtered.length) {
        return sendUploadError(res, "No valid employee IDs found.");
      }

      const sourceKeys = Object.keys(filtered[0]);
      const initialMapping = buildColumnMapping(sourceKeys);
      const columnMapping = dedupeDbColumns(initialMapping);

      const mappedSourceKeys = Object.keys(columnMapping);

      if (!mappedSourceKeys.length) {
        return sendUploadError(
          res,
          "No allowed payroll columns were found in the uploaded file."
        );
      }

      if (!Object.values(columnMapping).includes("employee_id")) {
        /*
          If your Excel first column is employee ID but has a different header,
          this fallback maps the first source column to employee_id.
        */
        const firstSourceKey = sourceKeys[0];

        if (!mappedSourceKeys.includes(firstSourceKey)) {
          columnMapping[firstSourceKey] = "employee_id";
          mappedSourceKeys.unshift(firstSourceKey);
        }
      }

      const dbColumnsArray = mappedSourceKeys.map(
        (sourceKey) => columnMapping[sourceKey]
      );

      const dbColumns = dbColumnsArray
        .map((column) => `\`${column}\``)
        .join(", ");

      const placeholders = dbColumnsArray.map(() => "?").join(", ");

      const insertSQL = `
        INSERT INTO 2001_cmx_appdata_finalpay_database.db_cmx_finalpay_payroll_data
        (${dbColumns})
        VALUES (${placeholders})
      `;

      const valuesBatch = filtered.map((row) =>
        mappedSourceKeys.map((sourceKey) => {
          const dbColumn = columnMapping[sourceKey];
          const rawValue = row[sourceKey];

          if (dbColumn === "employee_id") {
            const firstKey = Object.keys(row)[0];
            const fallbackEmpId = String(row[firstKey] || "").trim();
            const empId = String(rawValue || fallbackEmpId).trim();

            return isValidEmployeeId(empId) ? empId : null;
          }

          return transformValue(dbColumn, rawValue);
        })
      );

      const validValuesBatch = valuesBatch.filter((values) => {
        const employeeIdIndex = dbColumnsArray.indexOf("employee_id");

        if (employeeIdIndex === -1) return true;

        return isValidEmployeeId(values[employeeIdIndex]);
      });

      if (!validValuesBatch.length) {
        return sendUploadError(
          res,
          "No valid employee records found after validation."
        );
      }

      const conn = await db.getConnection();

      try {
        await conn.beginTransaction();

        for (const values of validValuesBatch) {
          await conn.execute(insertSQL, values);
        }

        await conn.commit();
      } catch (dbErr) {
        await conn.rollback();
        console.error("Payroll upload DB error:", dbErr);

        return res.status(500).json({
          success: false,
          error: "Upload failed while saving payroll data.",
        });
      } finally {
        conn.release();
      }

      return res.status(200).json({
        success: true,
        message: `${validValuesBatch.length} rows inserted.`,
        inserted: validValuesBatch.length,
      });
    } catch (err) {
      console.error("uploadFinalPay error:", err);

      if (err.message === "INVALID_FILE_TYPE") {
        return sendUploadError(res, "Invalid file type.");
      }

      if (err.code === "LIMIT_FILE_SIZE") {
        return sendUploadError(res, "File is too large. Maximum size is 10MB.");
      }

      return res.status(500).json({
        success: false,
        error: "Upload failed.",
      });
    }
  }
);

module.exports = router;
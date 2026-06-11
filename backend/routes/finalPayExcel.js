const express = require("express");
const ExcelJS = require("exceljs");
const path = require("path");
const db = require("../config/dbconfig");

const router = express.Router();

/* =====================================================
   Access Control
   -----------------------------------------------------
   Defense-in-depth:
   - index.js should already mount this router behind auth.
   - This file still checks req.user so it fails closed if
     someone accidentally mounts it without protection.
===================================================== */

const PAYROLL_EXPORT_ROLES = new Set([
  "dev",
  "accounting admin",
]);

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function normalizeEmpId(value) {
  return String(value || "").trim();
}

function hasPayrollExportRole(user) {
  return PAYROLL_EXPORT_ROLES.has(normalizeRole(user?.userLevel));
}

function isOwnRecord(req, empID) {
  const requestedEmpId = normalizeEmpId(empID);
  const userEmpId = normalizeEmpId(req.user?.empId);

  return userEmpId && requestedEmpId && userEmpId === requestedEmpId;
}

function requireFinalPayExportAccess(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized.",
    });
  }

  const { empID } = req.params;

  /*
    Allowed:
    - Admin / Super Admin / HR / Payroll / Finance
    - Employee exporting own record, if you want that behavior enabled

    If employees should NOT be allowed to export their own final pay,
    remove: || isOwnRecord(req, empID)
  */
  if (!hasPayrollExportRole(req.user) && !isOwnRecord(req, empID)) {
    return res.status(403).json({
      success: false,
      error: "Forbidden.",
    });
  }

  next();
}

/* =====================================================
   Helpers
===================================================== */

const toNumber = (val) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
};

const toDate = (val) => {
  if (!val) return null;

  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
};

const DATE_FIELDS = new Set([
  "birthday",
  "dob",
  "date_hired",
  "last_payout_cutoff",
  "date_resigned",
  "processed_date",
]);

function isValidEmpId(empID) {
  /*
    Adjust this if your employee IDs have a stricter format.
    This accepts numeric/alphanumeric IDs, dash, and underscore.
  */
  return /^[A-Za-z0-9_-]{1,30}$/.test(String(empID || "").trim());
}

function makeSafeFileName(value, fallback = "Employee") {
  const safe = String(value || fallback)
    .replace(/[\\/:*?"<>|,\r\n\t]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  return safe || fallback;
}

function setExcelDownloadHeaders(res, filename) {
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"`
  );

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  /*
    Payroll exports should not be cached by browser/proxy.
  */
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

function writeFieldMapToSheet(sheet, fieldMap) {
  sheet.eachRow((row) => {
    const keyRaw = row.getCell(1).value;
    const key = String(keyRaw || "").trim();

    if (!key || !(key in fieldMap)) return;

    const cell = row.getCell(2);
    const value = fieldMap[key];

    if (DATE_FIELDS.has(key)) {
      const dateVal = toDate(value);

      if (dateVal) {
        cell.value = dateVal;
        cell.numFmt = "mm/dd/yyyy";
      } else {
        cell.value = value || "";
      }

      return;
    }

    cell.value = value;
  });
}

/* =====================================================
   Route
===================================================== */

router.get("/excel/:empID", requireFinalPayExportAccess, async (req, res) => {
  const empID = normalizeEmpId(req.params.empID);

  if (!isValidEmpId(empID)) {
    return res.status(400).json({
      success: false,
      error: "Invalid employee ID.",
    });
  }

  try {
    const [rows] = await db.query(
      `
        SELECT *
        FROM 2001_cmx_appdata_finalpay_database.db_cmx_finalpay_data
        WHERE empID = ?
        LIMIT 1
      `,
      [empID]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        error: "Employee final pay record not found.",
      });
    }

    const employee = rows[0];

    const workbook = new ExcelJS.Workbook();

    const templatePath = path.resolve(
      __dirname,
      "../FileTemplate/cmx_fpc_template.xlsx"
    );

    await workbook.xlsx.readFile(templatePath);

    const sheet = workbook.getWorksheet("FinalPayData");

    if (!sheet) {
      console.error("FinalPay Excel template missing worksheet: FinalPayData");

      return res.status(500).json({
        success: false,
        error: "Excel template is not configured correctly.",
      });
    }

    const fieldMap = {
      empID: employee.empID || "",
      Name: employee.Name || "",
      position: employee.position || "",
      tin: employee.tin || "",
      address: employee.address || "",
      birthday: employee.birthday || "",
      monthly_rate: toNumber(employee.monthly_rate),
      daily_rate: toNumber(employee.daily_rate),
      bank_account_number: employee.bank_account_number || "",
      date_hired: employee.date_hired,
      last_payout_cutoff: employee.last_payout_cutoff,
      date_resigned: employee.date_resigned,

      unpaid_work_days: toNumber(employee.unpaid_work_days),
      unpaid_slvl_days: toNumber(employee.unpaid_slvl_days),
      ndiff_pct: toNumber(employee.ndiff_pct),
      skills_allowance: toNumber(employee.skills_allowance_amount),
      holiday_days: toNumber(employee.holiday_days),
      sl_remaining_days: toNumber(employee.sl_remaining_days),

      remaining_basic_pay: toNumber(employee.remaining_basic_pay),
      remaining_vl_pay: toNumber(employee.remaining_vl_pay),
      ndiff_amount: toNumber(employee.ndiff_amount),
      skills_allowance_amount: toNumber(employee.total_skills_allowance),
      holiday_pay_amount: toNumber(employee.holiday_pay_amount),
      adjustment_amount: toNumber(employee.adjustment_amount),
      others: toNumber(employee.others),
      other_due_to_employee: toNumber(employee.other_due_to_employee),
      sl_remaining: toNumber(employee.sl_remaining),
      other_accountabilities: toNumber(employee.other_accountabilities),
      outstanding_company_loans: toNumber(employee.outstanding_company_loans),

      thirteenth_month_partial: toNumber(employee.thirteenth_month_partial),
      ytd_gross_compensation: toNumber(employee.ytd_gross_compensation),
      less_non_taxable_comp: toNumber(employee.less_non_taxable_comp),
      thirteenth_month_capped: toNumber(employee.thirteenth_month_capped),
      thirteenth_month_total: toNumber(employee.thirteenth_month_total),

      sss_phic_hdmf: toNumber(employee.sss_phic_hdmf),
      other_non_tax_compensation: toNumber(employee.other_non_tax_compensation),
      net_taxable_income: toNumber(employee.net_taxable_income),
      tax_due: toNumber(employee.tax_due),
      total_withholding_tax_deductions: toNumber(
        employee.total_withholding_tax_deductions
      ),
      tax_due_refund: toNumber(employee.tax_due_refund),
      total_final_pay: toNumber(employee.total_final_pay),

      processed_by: employee.processed_by || "",
      processed_date: employee.processed_date,
      year: employee.year || "",
      contact: employee.contact || "",
      dob: employee.birthday || "",
    };

    writeFieldMapToSheet(sheet, fieldMap);

    const buffer = await workbook.xlsx.writeBuffer();

    const safeName = makeSafeFileName(employee.Name || empID);
    const filename = `FinalPay_${safeName}.xlsx`;

    setExcelDownloadHeaders(res, filename);

    return res.send(buffer);
  } catch (error) {
    console.error("FinalPay Excel export error:", error);

    return res.status(500).json({
      success: false,
      error: "Error generating Excel file.",
    });
  }
});

module.exports = router;
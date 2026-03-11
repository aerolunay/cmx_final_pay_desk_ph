const express = require("express");
const ExcelJS = require("exceljs");
const path = require("path");
const db = require("../config/dbconfig");

const router = express.Router();

/* -------------------------------------------------
 * Helpers
 * ------------------------------------------------- */

const toNumber = (val) => {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

const toDate = (val) => {
  const d = new Date(val);
  return isNaN(d) ? null : d;
};

const DATE_FIELDS = new Set([
  "date_hired",
  "last_payout_cutoff",
  "date_resigned",
  "processed_date",
]);

/* -------------------------------------------------
 * Route
 * ------------------------------------------------- */

router.get("/excel/:empID", async (req, res) => {
  const { empID } = req.params;

  try {
    /* ---------------- Fetch data ---------------- */

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
      return res.status(404).json({ message: "Employee not found." });
    }

    const employee = rows[0];

    /* ---------------- Load template ---------------- */

    const workbook = new ExcelJS.Workbook();
    const templatePath = path.resolve(
      __dirname,
      "../FileTemplate/cmx_fpc_template.xlsx"
    );

    await workbook.xlsx.readFile(templatePath);

    const sheet = workbook.getWorksheet("FinalPayData");
    if (!sheet) {
      return res.status(500).json({
        message: "Template sheet 'FinalPayData' not found.",
      });
    }

    /* ---------------- Field map ---------------- */

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
      year: employee.year,
      contact: employee.contact || "",
      dob: employee.birthday || ""

    };

    /* ---------------- Write values ---------------- */

    sheet.eachRow((row) => {
      const key = row.getCell(1).value;
      if (!key || !(key in fieldMap)) return;

      const cell = row.getCell(2);
      const value = fieldMap[key];

      if (DATE_FIELDS.has(key)) {
        const dateVal = toDate(value);
        if (dateVal) {
          cell.value = dateVal;
          cell.numFmt = "mm/dd/yyyy";
        } else {
          cell.value = value;
        }
      } else {
        cell.value = value;
      }
    });

    /* ---------------- Send file ---------------- */

    const buffer = await workbook.xlsx.writeBuffer();

    const safeName = String(employee.Name || empID)
      .replace(/[\\/:*?"<>|,]/g, "_")
      .trim();

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="FinalPay_${safeName}.xlsx"`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.send(buffer);

  } catch (error) {
    console.error("❌ Excel export error:", error);
    res.status(500).json({
      message: "Error generating Excel file",
      error: error.message || String(error),
    });
  }
});

module.exports = router;

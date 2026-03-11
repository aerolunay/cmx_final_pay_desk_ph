const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const dayjs = require("dayjs");
const db = require("../config/dbconfig");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB safety cap
});

/* -------------------------------------------------
 * Utilities
 * ------------------------------------------------- */

// Normalize column headers → MySQL-safe keys
const normalizeKey = (key) =>
  key
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\w]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

// Clean numeric values (₱, commas, text)
const cleanNumeric = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;

  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  return cleaned === "" || isNaN(cleaned) ? null : Number(cleaned);
};

// Normalize date → YYYY-MM-DD
const cleanDate = (value) => {
  if (!value) return null;

  const parsed = dayjs(value, [
    "MM/DD/YYYY",
    "YYYY-MM-DD",
    "DD/MM/YYYY",
  ], true);

  return parsed.isValid() ? parsed.format("YYYY-MM-DD") : null;
};

/* -------------------------------------------------
 * Field definitions
 * ------------------------------------------------- */

const numericFields = new Set([
  "basic_monthly_salary",
  "total_monthly_salary",
  "allowance",
  "gross_day",
  "de_minimis_benefits_semi_monthly",
  "monthly_de_minimis_benefits",
]);

const dateFields = new Set([
  "date_hired",
]);

/* -------------------------------------------------
 * Route
 * ------------------------------------------------- */

router.post("/uploadFinalPay", upload.single("file"), async (req, res) => {
  try {
    console.log("🟢 uploadFinalPay invoked");

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    console.log("📦 File:", req.file.originalname);

    // Parse Excel
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets["Summary"];

    if (!sheet) {
      return res.status(400).json({
        success: false,
        error: "Summary sheet not found",
      });
    }

    // Skip first 4 rows (metadata)
    const rows = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      range: 4,
    });

    console.log("📊 Rows read:", rows.length);

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        error: "No data rows found",
      });
    }

    // Filter valid employee IDs (column A starts with 7xxxxxx)
    const filtered = rows.filter((row) => {
      const firstKey = Object.keys(row)[0];
      const empId = String(row[firstKey] || "").trim();
      return /^7\d{6}$/.test(empId);
    });

    console.log("🧪 Valid employee rows:", filtered.length);

    if (!filtered.length) {
      return res.status(400).json({
        success: false,
        error: "No valid Employee IDs found",
      });
    }

    /* -------------------------------------------------
     * Column mapping
     * ------------------------------------------------- */

    const sourceKeys = Object.keys(filtered[0]);

    const colMap = {};
    sourceKeys.forEach((k) => {
      colMap[k] = normalizeKey(k);
    });

    const dbColumns = Object.values(colMap).map((c) => `\`${c}\``).join(", ");
    const placeholders = sourceKeys.map(() => "?").join(", ");

    const insertSQL = `
      INSERT INTO 2001_cmx_appdata_finalpay_database.db_cmx_finalpay_payroll_data
      (${dbColumns})
      VALUES (${placeholders})
    `;

    /* -------------------------------------------------
     * Prepare batch values
     * ------------------------------------------------- */

    const valuesBatch = filtered.map((row) =>
      sourceKeys.map((key) => {
        const dbKey = colMap[key];
        const raw = row[key];

        if (numericFields.has(dbKey)) return cleanNumeric(raw);
        if (dateFields.has(dbKey)) return cleanDate(raw);

        return typeof raw === "string" ? raw.trim() : raw ?? null;
      })
    );

    /* -------------------------------------------------
     * Insert (transactional)
     * ------------------------------------------------- */

    const conn = await db.getConnection();

    try {
      await conn.beginTransaction();

      for (const values of valuesBatch) {
        await conn.execute(insertSQL, values);
      }

      await conn.commit();
    } catch (dbErr) {
      await conn.rollback();
      throw dbErr;
    } finally {
      conn.release();
    }

    console.log(`✅ Inserted ${valuesBatch.length} rows`);

    return res.status(200).json({
      success: true,
      message: `${valuesBatch.length} rows inserted.`,
    });

  } catch (err) {
    console.error("❌ uploadFinalPay error:", err);

    return res.status(500).json({
      success: false,
      error: "Upload failed",
      details: err.message,
    });
  }
});

module.exports = router;

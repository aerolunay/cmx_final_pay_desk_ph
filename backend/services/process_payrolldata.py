import os
import re
import unicodedata
import pandas as pd
from io import BytesIO
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from urllib.parse import quote_plus

# -------------------------------------------------
# Environment & DB Setup
# -------------------------------------------------

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

db_user = os.getenv("MYSQL_USER")
db_pass_raw = os.getenv("MYSQL_PASSWORD")
db_host = os.getenv("MYSQL_HOST")

if not all([db_user, db_pass_raw, db_host]):
    raise RuntimeError("Missing required MySQL environment variables")

db_pass = quote_plus(db_pass_raw)

DB_NAME = "2001_cmx_appdata_finalpay_database"
TABLE_NAME = "db_cmx_finalpay_payroll_data"

engine = create_engine(
    f"mysql+pymysql://{db_user}:{db_pass}@{db_host}/{DB_NAME}",
    pool_pre_ping=True,
    pool_recycle=3600,
)

# -------------------------------------------------
# Utilities
# -------------------------------------------------

def normalize(col: str) -> str:
    """Normalize column names for matching"""
    col = unicodedata.normalize("NFKD", str(col))
    col = col.lower()
    col = re.sub(r"\(.*?\)", "", col)   # remove (hh:mm), (LESS), etc
    col = re.sub(r"[^a-z0-9]", "", col) # remove spaces/symbols
    return col

# -------------------------------------------------
# SQL Column List (SOURCE OF TRUTH)
# -------------------------------------------------

SQL_COLUMNS = [
    "employee_id","fullname","position","department","date_hired",
    "employment_status","bank_account_number","cost_center","gender",
    "work_days_per_year","basic_monthly_salary",
    "monthly_de_minimis_benefits","total_monthly_salary",
    "basic_salary_semi_monthly","gross_day","basic_hr_8_hours",
    "de_minimis_benefits_semi_monthly","13th_month_nontaxable",
    "allowance","basic_adj","basic_adj_1","expense_account",
    "lh_adj","lh_adj_1","lh_nd_adj","lh_nd_adj_1","lh_ot_adj",
    "lh_rd_adj","lh_rd_nd_adj","misc_adj","nd_adj","ord_nd",
    "ord_nd_adj","ord_nd_adj_1","ord_nd_ot_adj","ord_ot",
    "ord_ot_adj","ord_ot_adj_1","ot_adj","rd_adj","rd_nd_adj",
    "rd_nd_adj_1","rdot_adj","rdot_adj_1","sh_adj","sh_adj_1",
    "sh_nd_adj","sh_nd_ot_adj","sh_ot_adj",
    "skill_allowance","skills_allowance","skills_allowance_adj",
    "skills_allownace","sl_adj","sme_allowance","sss_return",
    "sssee","ord_nd_1","ord_ndhhmm","ord_ot_1","ord_othhmm",
    "ord_nd_ot","ord_nd_othhmm","rd_nd","rd_ndhhmm","rd_ot",
    "rd_othhmm","rd","rdhhmm","sh_nd","sh_ndhhmm","sh_ot",
    "sh_othhmm","sh_nd_ot","sh_nd_othhmm","sh","shhhmm",
    "sh_rd","sh_rdhhmm","lh_nd","lh_ndhhmm","lh_ot","lh_othhmm",
    "lh_nd_ot","lh_nd_othhmm","lh","lhhhmm","lh_rd_nd",
    "lh_rd_ndhhmm","lh_rd","lh_rdhhmm","ot_total","total_salary",
    "days_absent","total_absent_deduction",
    "deminimis_absent_deduction","allowance_absent_deduction",
    "discretionary_deduction","minutes_late","total_late_deduction",
    "withholding_tax","sss","philhealth","hdmf",
    "bank_charge_less","basic_adj_less","basic_adj_less_1",
    "company_loan_less","company_loan_less_1","company_phone_less",
    "company_phone123_less","hdmf_calamity_loan_less",
    "hdmf_calamity_loan_less_1","hdmf_loan_less","hdmf_loan_less_1",
    "hdmf_loan_less_2","hdmf_salary_loan_less","hdmfcaloan_less",
    "hdmfloan_less","hdmfloan_less_1","hmdf_calamity_loan_less",
    "hmdf_calamity_loan_less_1","lh_adj_less","lh_nd_adj_less",
    "miscellaneous_less","ord_nd_adj_less","ord_ot_adj_less",
    "rd_adj_less","rd_adj_less_1","rd_nd_adj_less",
    "rd_nd_adj_less_1","sss_calamity_loan_less",
    "sss_calamity_loan_less_1","sss_loan_less",
    "sss_salary_loan_less","sss_salary_loan_less_1",
    "sss_salary_loan__less","withholding_tax_less",
    "witholding_tax_less","deductions_total","net_pay",
    "taxable_gross","tax_adj","sssee_adj","ssser","sssec",
    "pher","hdmfer","hdmf_additional"
]

SQL_NORMALIZED = {normalize(c): c for c in SQL_COLUMNS}

NUMERIC_COLUMNS = set(SQL_COLUMNS) - {
    "employee_id","fullname","position","department",
    "date_hired","employment_status",
    "bank_account_number","cost_center","gender"
}

# -------------------------------------------------
# MAIN HANDLER
# -------------------------------------------------

def handle_excel_upload(file_content: bytes, filename: str) -> dict:
    print(f"📄 Processing file: {filename}")

    if isinstance(file_content, str):
        file_content = file_content.encode()

    # ---------------- Read Excel (Row 4 = headers) ----------------
    df = pd.read_excel(
        BytesIO(file_content),
        sheet_name="Summary",
        header=3
    )

    if df.empty:
        raise ValueError("Excel file is empty")

    # ---------------- Normalize Excel Headers ----------------
    excel_columns = list(df.columns)
    normalized_excel = {normalize(col): col for col in excel_columns}

    # ---------------- Build Mapping ----------------
    mapping = {
        normalized_excel[norm]: SQL_NORMALIZED[norm]
        for norm in normalized_excel
        if norm in SQL_NORMALIZED
    }

    if not mapping:
        raise ValueError("No matching fields found between Excel and database")

    print(f"🔗 Matched {len(mapping)} fields")

    # ---------------- Apply Mapping ----------------
    df = df[list(mapping.keys())].rename(columns=mapping)

    # ---------------- Filter Valid Employees ----------------
    if "employee_id" in df.columns:
        df = df[df["employee_id"].astype(str).str.startswith("700")]

    if df.empty:
        return {"inserted": 0, "message": "No valid employee records found"}

    # ---------------- Numeric Conversion ----------------
    for col in NUMERIC_COLUMNS.intersection(df.columns):
        df[col] = (
            df[col]
            .astype(str)
            .str.replace(",", "", regex=False)
            .str.strip()
        )
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # ---------------- Date Conversion ----------------
    if "date_hired" in df.columns:
        df["date_hired"] = pd.to_datetime(df["date_hired"], errors="coerce").dt.date

    # ---------------- DB INSERT (DELETE FIRST) ----------------
    with engine.begin() as conn:
        conn.execute(text(f"DELETE FROM {TABLE_NAME}"))
        print("🧹 Existing payroll records cleared")

        df.to_sql(
            TABLE_NAME,
            con=conn,
            if_exists="append",
            index=False,
            method="multi",
            chunksize=1000,
        )

    print(f"✅ Inserted {len(df)} payroll records")

    return {
        "inserted": len(df),
        "message": "Upload successful",
    }

import os
import re
import uuid
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
db_port = os.getenv("MYSQL_PORT", "3306")

if not all([db_user, db_pass_raw, db_host]):
    raise RuntimeError("Missing required MySQL environment variables")

db_pass = quote_plus(db_pass_raw)

DB_NAME = os.getenv("MYSQL_DATABASE", "2001_cmx_appdata_finalpay_database")
TABLE_NAME = os.getenv("PAYROLL_TABLE", "db_cmx_finalpay_payroll_data")

MIN_VALID_ROWS_FOR_REPLACE = int(os.getenv("MIN_VALID_ROWS_FOR_REPLACE", "1"))
UPLOAD_CHUNKSIZE = int(os.getenv("UPLOAD_CHUNKSIZE", "1000"))

engine = create_engine(
    f"mysql+pymysql://{db_user}:{db_pass}@{db_host}:{db_port}/{DB_NAME}",
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_size=5,
    max_overflow=10,
)

# -------------------------------------------------
# Utilities
# -------------------------------------------------

def normalize(col: str) -> str:
    """
    Normalize column names for matching.
    Example:
    - "ORD ND (hh:mm)" -> "ordnd"
    - "Company Loan (LESS)" -> "companyloan"
    """
    col = unicodedata.normalize("NFKD", str(col or ""))
    col = col.lower()
    col = re.sub(r"\(.*?\)", "", col)
    col = re.sub(r"[^a-z0-9]", "", col)
    return col


def quote_identifier(identifier: str) -> str:
    """
    Quote SQL identifiers safely.
    Only allows alphanumeric and underscore.
    """
    if not re.fullmatch(r"[A-Za-z0-9_]+", identifier or ""):
        raise ValueError(f"Invalid SQL identifier: {identifier}")

    return f"`{identifier}`"


def is_valid_employee_id(value) -> bool:
    """
    Your Node uploader was accepting 7xxxxxx.
    The previous Python version accepted anything starting with 700.
    This accepts 7 digits starting with 7.
    """
    return bool(re.fullmatch(r"7\d{6}", str(value or "").strip()))


def clean_text(value):
    if pd.isna(value):
        return None

    text_value = str(value).strip()

    if not text_value or text_value.lower() in {"nan", "none", "null"}:
        return None

    return text_value


def clean_employee_id(value):
    text_value = clean_text(value)

    if not text_value:
        return None

    # Excel sometimes reads numeric IDs as 7000001.0
    if re.fullmatch(r"\d+\.0", text_value):
        text_value = text_value[:-2]

    return text_value if is_valid_employee_id(text_value) else None


# -------------------------------------------------
# SQL Column List (SOURCE OF TRUTH)
# -------------------------------------------------

SQL_COLUMNS = [
    "employee_id", "fullname", "position", "department", "date_hired",
    "employment_status", "bank_account_number", "cost_center", "gender",
    "work_days_per_year", "basic_monthly_salary",
    "monthly_de_minimis_benefits", "total_monthly_salary",
    "basic_salary_semi_monthly", "gross_day", "basic_hr_8_hours",
    "de_minimis_benefits_semi_monthly", "13th_month_nontaxable",
    "allowance", "basic_adj", "basic_adj_1", "expense_account",
    "lh_adj", "lh_adj_1", "lh_nd_adj", "lh_nd_adj_1", "lh_ot_adj",
    "lh_rd_adj", "lh_rd_nd_adj", "misc_adj", "nd_adj", "ord_nd",
    "ord_nd_adj", "ord_nd_adj_1", "ord_nd_ot_adj", "ord_ot",
    "ord_ot_adj", "ord_ot_adj_1", "ot_adj", "rd_adj", "rd_nd_adj",
    "rd_nd_adj_1", "rdot_adj", "rdot_adj_1", "sh_adj", "sh_adj_1",
    "sh_nd_adj", "sh_nd_ot_adj", "sh_ot_adj",
    "skill_allowance", "skills_allowance", "skills_allowance_adj",
    "skills_allownace", "sl_adj", "sme_allowance", "sss_return",
    "sssee", "ord_nd_1", "ord_ndhhmm", "ord_ot_1", "ord_othhmm",
    "ord_nd_ot", "ord_nd_othhmm", "rd_nd", "rd_ndhhmm", "rd_ot",
    "rd_othhmm", "rd", "rdhhmm", "sh_nd", "sh_ndhhmm", "sh_ot",
    "sh_othhmm", "sh_nd_ot", "sh_nd_othhmm", "sh", "shhhmm",
    "sh_rd", "sh_rdhhmm", "lh_nd", "lh_ndhhmm", "lh_ot", "lh_othhmm",
    "lh_nd_ot", "lh_nd_othhmm", "lh", "lhhhmm", "lh_rd_nd",
    "lh_rd_ndhhmm", "lh_rd", "lh_rdhhmm", "ot_total", "total_salary",
    "days_absent", "total_absent_deduction",
    "deminimis_absent_deduction", "allowance_absent_deduction",
    "discretionary_deduction", "minutes_late", "total_late_deduction",
    "withholding_tax", "sss", "philhealth", "hdmf",
    "bank_charge_less", "basic_adj_less", "basic_adj_less_1",
    "company_loan_less", "company_loan_less_1", "company_phone_less",
    "company_phone123_less", "hdmf_calamity_loan_less",
    "hdmf_calamity_loan_less_1", "hdmf_loan_less", "hdmf_loan_less_1",
    "hdmf_loan_less_2", "hdmf_salary_loan_less", "hdmfcaloan_less",
    "hdmfloan_less", "hdmfloan_less_1", "hmdf_calamity_loan_less",
    "hmdf_calamity_loan_less_1", "lh_adj_less", "lh_nd_adj_less",
    "miscellaneous_less", "ord_nd_adj_less", "ord_ot_adj_less",
    "rd_adj_less", "rd_adj_less_1", "rd_nd_adj_less",
    "rd_nd_adj_less_1", "sss_calamity_loan_less",
    "sss_calamity_loan_less_1", "sss_loan_less",
    "sss_salary_loan_less", "sss_salary_loan_less_1",
    "sss_salary_loan__less", "withholding_tax_less",
    "witholding_tax_less", "deductions_total", "net_pay",
    "taxable_gross", "tax_adj", "sssee_adj", "ssser", "sssec",
    "pher", "hdmfer", "hdmf_additional"
]

SQL_NORMALIZED = {normalize(c): c for c in SQL_COLUMNS}

TEXT_COLUMNS = {
    "employee_id",
    "fullname",
    "position",
    "department",
    "employment_status",
    "bank_account_number",
    "cost_center",
    "gender",
    "expense_account",
}

DATE_COLUMNS = {
    "date_hired",
}

NUMERIC_COLUMNS = set(SQL_COLUMNS) - TEXT_COLUMNS - DATE_COLUMNS

# -------------------------------------------------
# Data Cleaning
# -------------------------------------------------

def build_mapping(excel_columns):
    normalized_excel = {}

    for col in excel_columns:
        norm = normalize(col)

        # Preserve first match only to prevent duplicate normalized columns
        if norm and norm not in normalized_excel:
            normalized_excel[norm] = col

    mapping = {
        normalized_excel[norm]: SQL_NORMALIZED[norm]
        for norm in normalized_excel
        if norm in SQL_NORMALIZED
    }

    return mapping


def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    # Normalize empty values
    df = df.replace({pd.NA: None})
    df = df.where(pd.notnull(df), None)

    if "employee_id" not in df.columns:
        raise ValueError("Employee ID column was not found in the uploaded file")

    df["employee_id"] = df["employee_id"].apply(clean_employee_id)
    df = df[df["employee_id"].notna()]

    if df.empty:
        return df

    # Drop duplicate employee IDs within the same upload, keeping latest row
    df = df.drop_duplicates(subset=["employee_id"], keep="last")

    for col in TEXT_COLUMNS.intersection(df.columns):
        if col == "employee_id":
            continue

        df[col] = df[col].apply(clean_text)

    for col in NUMERIC_COLUMNS.intersection(df.columns):
        df[col] = (
            df[col]
            .astype(str)
            .str.replace(",", "", regex=False)
            .str.replace("₱", "", regex=False)
            .str.replace("%", "", regex=False)
            .str.strip()
        )

        df[col] = pd.to_numeric(df[col], errors="coerce")

    for col in DATE_COLUMNS.intersection(df.columns):
        df[col] = pd.to_datetime(df[col], errors="coerce").dt.date
        df[col] = df[col].where(pd.notnull(df[col]), None)

    # Keep only known SQL columns, preserving SQL_COLUMNS order
    ordered_cols = [col for col in SQL_COLUMNS if col in df.columns]
    df = df[ordered_cols]

    return df


# -------------------------------------------------
# Database Replace
# -------------------------------------------------

def replace_payroll_table_safely(df: pd.DataFrame) -> None:
    if df.empty:
        raise ValueError("No valid rows available for database insert")

    if len(df) < MIN_VALID_ROWS_FOR_REPLACE:
        raise ValueError(
            f"Upload has only {len(df)} valid rows. "
            f"Minimum required is {MIN_VALID_ROWS_FOR_REPLACE}."
        )

    table_quoted = quote_identifier(TABLE_NAME)
    staging_table = f"{TABLE_NAME}_staging_{uuid.uuid4().hex[:12]}"
    staging_quoted = quote_identifier(staging_table)

    with engine.begin() as conn:
        try:
            # Create staging table with the same structure as the live table
            conn.execute(
                text(
                    f"CREATE TABLE {staging_quoted} LIKE {table_quoted}"
                )
            )

            # Insert upload into staging first
            df.to_sql(
                staging_table,
                con=conn,
                if_exists="append",
                index=False,
                method="multi",
                chunksize=UPLOAD_CHUNKSIZE,
            )

            count_result = conn.execute(
                text(f"SELECT COUNT(*) FROM {staging_quoted}")
            ).scalar()

            if int(count_result or 0) != len(df):
                raise ValueError("Staging row count did not match upload row count")

            # Replace live table only after staging succeeds
            conn.execute(text(f"DELETE FROM {table_quoted}"))

            column_list = ", ".join(quote_identifier(col) for col in df.columns)

            conn.execute(
                text(
                    f"""
                    INSERT INTO {table_quoted} ({column_list})
                    SELECT {column_list}
                    FROM {staging_quoted}
                    """
                )
            )

        finally:
            # Cleanup staging table whether transaction succeeds or fails
            conn.execute(text(f"DROP TABLE IF EXISTS {staging_quoted}"))


# -------------------------------------------------
# Main Handler
# -------------------------------------------------

def handle_excel_upload(file_content: bytes, filename: str) -> dict:
    print(f"📄 Processing payroll file: {filename}")

    if isinstance(file_content, str):
        file_content = file_content.encode()

    if not isinstance(file_content, (bytes, bytearray)):
        raise ValueError("Invalid file content")

    if len(file_content) == 0:
        raise ValueError("Excel file is empty")

    try:
        df_raw = pd.read_excel(
            BytesIO(file_content),
            sheet_name="Summary",
            header=3,
            engine="openpyxl",
        )
    except ValueError as err:
        # This commonly catches missing sheet names
        raise ValueError("Unable to read Summary sheet from Excel file") from err
    except Exception as err:
        raise ValueError("Unable to read Excel file") from err

    if df_raw.empty:
        raise ValueError("Excel file contains no data rows")

    mapping = build_mapping(list(df_raw.columns))

    if not mapping:
        raise ValueError("No matching fields found between Excel and database")

    print(f"🔗 Matched {len(mapping)} payroll fields")

    df = df_raw[list(mapping.keys())].rename(columns=mapping)
    df = clean_dataframe(df)

    if df.empty:
        return {
            "inserted": 0,
            "message": "No valid employee records found",
        }

    print(f"🧪 Valid payroll records after cleanup: {len(df)}")

    replace_payroll_table_safely(df)

    print(f"✅ Payroll table replaced with {len(df)} records")

    return {
        "inserted": len(df),
        "message": "Upload successful",
    }
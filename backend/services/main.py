import os
from dotenv import load_dotenv

from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from starlette.responses import JSONResponse

from services.process_payrolldata import handle_excel_upload

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))

FRONTEND_URL = os.getenv("FRONTEND_URL", "https://fpdesk.cmxph.com")
NODE_ENV = os.getenv("NODE_ENV", "development")

PYTHON_SERVICE_TOKEN = os.getenv("PYTHON_SERVICE_TOKEN", "")
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "10"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

app = FastAPI(title="FPDesk Python Service")

if NODE_ENV == "production" and len(PYTHON_SERVICE_TOKEN) < 32:
    print(
        "⚠️ PYTHON_SERVICE_TOKEN is missing or too short. "
        "Use at least 32 random characters in production."
    )

# ---------------- CORS ----------------

origins = [
    "http://localhost:3000",
    "https://fpdesk.cmxph.com",
    FRONTEND_URL,
]

origins = list(dict.fromkeys([o for o in origins if o]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Service-Token"],
)


# ---------------- Security Headers ----------------

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Cache-Control"] = "no-store"

    if NODE_ENV == "production":
        response.headers[
            "Strict-Transport-Security"
        ] = "max-age=31536000; includeSubDomains; preload"

    return response


# ---------------- Error Handler ----------------

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    print("❌ Unhandled service error:", repr(exc))

    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "message": "Internal server error.",
        },
    )


# ---------------- Helpers ----------------

def verify_service_token(x_service_token: str = ""):
    if not PYTHON_SERVICE_TOKEN:
        raise HTTPException(status_code=503, detail="Service token not configured")

    if not x_service_token or x_service_token != PYTHON_SERVICE_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")


def is_allowed_excel_filename(filename: str) -> bool:
    clean_name = (filename or "").lower().strip()
    return clean_name.endswith(".xlsx") or clean_name.endswith(".xls")


def has_excel_signature(file_bytes: bytes, filename: str) -> bool:
    """
    Basic file signature check:
    - .xlsx is a ZIP container and usually starts with PK.
    - .xls legacy binary often starts with D0 CF 11 E0.
    """

    if not file_bytes:
        return False

    clean_name = (filename or "").lower().strip()

    if clean_name.endswith(".xlsx"):
        return file_bytes.startswith(b"PK")

    if clean_name.endswith(".xls"):
        return file_bytes.startswith(b"\xD0\xCF\x11\xE0")

    return False


# ---------------- Startup ----------------

@app.on_event("startup")
async def startup():
    print("🚀 FPDesk Python Service started")
    print("🌐 Allowed CORS origins:", origins)
    print("🧩 Environment:", NODE_ENV)
    print(f"📦 Max upload size: {MAX_UPLOAD_MB}MB")


# ---------------- Health ----------------

@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "fpdesk-python",
        "env": NODE_ENV,
    }


# ---------------- Upload Endpoint ----------------

@app.post("/webhook/upload-excel")
async def upload_excel(
    file: UploadFile = File(...),
    x_service_token: str = Header(default=""),
):
    verify_service_token(x_service_token)

    if not file:
        raise HTTPException(status_code=400, detail="No file uploaded")

    if not is_allowed_excel_filename(file.filename):
        raise HTTPException(status_code=400, detail="Invalid file type")

    try:
        file_bytes = await file.read()

        if not isinstance(file_bytes, (bytes, bytearray)):
            raise HTTPException(status_code=400, detail="Invalid uploaded file")

        if len(file_bytes) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")

        if len(file_bytes) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File is too large. Maximum size is {MAX_UPLOAD_MB}MB.",
            )

        if not has_excel_signature(file_bytes, file.filename):
            raise HTTPException(status_code=400, detail="Invalid Excel file")

        result = await run_in_threadpool(
            handle_excel_upload,
            file_bytes,
            file.filename,
        )

        return {
            "status": "success",
            "inserted": result.get("inserted", 0),
            "message": result.get("message", "Upload successful"),
        }

    except HTTPException:
        raise

    except Exception as e:
        print("❌ Excel processing error:", repr(e))

        raise HTTPException(
            status_code=500,
            detail="Excel processing failed.",
        )
import os
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool

from services.process_payrolldata import handle_excel_upload

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))

FRONTEND_URL = os.getenv("FRONTEND_URL")
NODE_ENV = os.getenv("NODE_ENV", "unknown")

app = FastAPI(title="FPDesk Python Service")

# ---------------- CORS ----------------
origins = [
    "http://localhost:3000",
    FRONTEND_URL,
]
origins = [o for o in origins if o]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    print("🚀 FPDesk Python Service started")
    print("🌐 Allowed CORS origins:", origins)
    print("🧩 Environment:", NODE_ENV)

@app.get("/health")
def health():
    return {"ok": True}

ALLOWED_TYPES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
}

@app.post("/webhook/upload-excel")
async def upload_excel(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Invalid file type")

    try:
        # ✅ ALWAYS READ BYTES HERE
        file_bytes = await file.read()

        if not isinstance(file_bytes, (bytes, bytearray)):
            raise TypeError(f"Upload read() returned {type(file_bytes)}")

        result = await run_in_threadpool(
            handle_excel_upload,
            file_bytes,
            file.filename,
        )

        return {
            "status": "success",
            "inserted": result.get("inserted", 0),
            "message": result.get("message", ""),
        }

    except Exception as e:
        print("❌ Excel processing error:", repr(e))
        raise HTTPException(status_code=500, detail=str(e))

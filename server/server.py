"""Server tes opsional (kalau tidak mau memakai Cloudflare).
Jalankan:  pip install fastapi uvicorn   lalu   python server/server.py
Buka http://localhost:8000 (menyajikan folder web ini), atau http://IP-LAPTOP:8000 dari HP.
"""
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Laju test server")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
_CHUNK = os.urandom(64 * 1024)


@app.get("/api/ping")
def ping():
    return {"ok": True}


@app.get("/api/download")
def download(mb: int = 25):
    mb = max(1, min(mb, 200))

    def gen():
        for _ in range(mb * 16):
            yield _CHUNK

    return StreamingResponse(gen(), media_type="application/octet-stream", headers={"Cache-Control": "no-store"})


@app.post("/api/upload")
async def upload(request: Request):
    received = 0
    async for chunk in request.stream():
        received += len(chunk)
    return {"bytes": received}


app.mount("/", StaticFiles(directory=Path(__file__).resolve().parent.parent, html=True), name="web")

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

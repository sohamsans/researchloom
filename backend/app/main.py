from contextlib import asynccontextmanager
import os
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routers import review, export, assistant, auth, vault, references, notes, flow, tablet, stats, calc, matrix
from app.db.database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(
    title="LitBuddy API",
    description="LitBuddy: Autonomous Literature Review Engine with Dual-Layer Caching, Document Vault, and Multi-Provider BYOK Hub.",
    version="4.2.0",
    lifespan=lifespan
)

# CORS setup for Netlify frontend and local Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(review.router)
app.include_router(export.router)
app.include_router(assistant.router)
app.include_router(auth.router)
app.include_router(vault.router)
app.include_router(references.router)
app.include_router(notes.router)
app.include_router(flow.router)
app.include_router(tablet.router)
app.include_router(stats.router)
app.include_router(calc.router)
app.include_router(matrix.router)

TABLET_PAD_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, maximum-scale=1.0">
  <title>LitBuddy Stylus Pad</title>
  <style>
    body { margin: 0; padding: 0; background: #07080a; color: #ededed; font-family: -apple-system, sans-serif; overflow: hidden; touch-action: none; }
    header { height: 48px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; background: #0e0f12; border-bottom: 1px solid #27272a; }
    h1 { font-size: 14px; margin: 0; font-weight: 600; }
    button { background: #27272a; color: #fff; border: 1px solid #3f3f46; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; }
    button.primary { background: #fff; color: #000; font-weight: 600; border: none; }
    canvas { display: block; width: 100vw; height: calc(100vh - 48px); background: #07080a; touch-action: none; cursor: crosshair; }
  </style>
</head>
<body>
  <header>
    <h1>LitBuddy Wireless Stylus Pad</h1>
    <div style="display:flex;gap:8px;">
      <button onclick="clearCanvas()">Clear</button>
      <button class="primary" onclick="sendToLitBuddy()">Send to Paper</button>
    </div>
  </header>
  <canvas id="pad"></canvas>
  <script>
    const canvas = document.getElementById('pad');
    const ctx = canvas.getContext('2d');
    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight - 48;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
    window.addEventListener('resize', resize);
    resize();

    let drawing = false;
    function getPos(e) {
      if (e.touches && e.touches[0]) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY - 48 };
      }
      return { x: e.clientX, y: e.clientY - 48 };
    }

    function startDraw(e) { drawing = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
    function draw(e) { if (!drawing) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); }
    function endDraw() { drawing = false; }

    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', endDraw);
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', endDraw);

    function clearCanvas() { ctx.clearRect(0, 0, canvas.width, canvas.height); }
    async function sendToLitBuddy() {
      const dataUrl = canvas.toDataURL('image/png');
      try {
        const resp = await fetch('/api/tablet/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_data: dataUrl })
        });
        if (resp.ok) alert('Drawing transmitted to LitBuddy successfully!');
      } catch (e) {
        alert('Network error sending drawing: ' + e);
      }
    }
  </script>
</body>
</html>"""

@app.get("/tablet-pad", response_class=HTMLResponse)
def get_tablet_pad():
    """Lightweight pressure/touch drawing page for wireless iPad / Android tablet pairing."""
    return TABLET_PAD_HTML

# Mount local frontend production assets if present (for Windows standalone executable & local mode)
import sys

def get_frontend_dist() -> str:
    # 1. PyInstaller bundled temp directory
    if hasattr(sys, "_MEIPASS"):
        meipass_dist = os.path.join(sys._MEIPASS, "frontend_dist")
        if os.path.exists(meipass_dist):
            return meipass_dist
    # 2. Local executable directory
    exe_dist = os.path.join(os.path.dirname(sys.executable), "frontend_dist")
    if os.path.exists(exe_dist):
        return exe_dist
    # 3. Source repository relative directory
    src_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
    if os.path.exists(src_dist):
        return src_dist
    return ""

FRONTEND_DIST = get_frontend_dist()
if FRONTEND_DIST and os.path.exists(os.path.join(FRONTEND_DIST, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")

@app.get("/")
def root():
    if FRONTEND_DIST:
        index_file = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.exists(index_file):
            from fastapi.responses import FileResponse
            return FileResponse(index_file)
    return {
        "app": "LitBuddy",
        "status": "online",
        "docs": "/docs",
        "version": "4.0.0"
    }

@app.get("/api/health")
def health_check():
    """Lightweight health probe used by the desktop splash screen."""
    return {"status": "ok", "version": "4.1.0"}

@app.get("/{full_path:path}")
def catch_all(full_path: str):
    """Serve any client assets or fallback to index.html for SPA routes."""
    if full_path.startswith("api/") or full_path == "tablet-pad":
        raise HTTPException(status_code=404, detail="Not Found")
    if FRONTEND_DIST:
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        index_file = os.path.join(FRONTEND_DIST, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="Not Found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

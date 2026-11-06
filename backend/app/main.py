from contextlib import asynccontextmanager
import os
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routers import review, export, assistant, auth, vault, references, notes, flow, tablet, stats, calc, matrix, screening, clipper, sync, updater, mcp_router, snowball
from app.db.database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(
    title="ResearchLoom API",
    description="ResearchLoom (Samhita): Autonomous Literature Review Engine with Dual-Layer Caching, Document Vault, and Multi-Provider BYOK Hub.",
    version="4.3.8",
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
app.include_router(screening.router)
app.include_router(clipper.router)
app.include_router(sync.router)
app.include_router(updater.router)
app.include_router(mcp_router.router)
app.include_router(snowball.router)

TABLET_PAD_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, maximum-scale=1.0">
  <title>ResearchLoom Stylus Pad</title>
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body { margin: 0; padding: 0; background: #07080a; color: #ededed; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; overflow: hidden; touch-action: none; user-select: none; }
    header { height: 52px; display: flex; align-items: center; justify-content: space-between; padding: 0 14px; background: #0e0f12; border-bottom: 1px solid #27272a; }
    .title-group { display: flex; align-items: center; gap: 8px; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px rgba(16,185,129,0.5); }
    h1 { font-size: 13px; margin: 0; font-weight: 600; letter-spacing: -0.2px; color: #f4f4f5; }
    .badge { font-size: 10px; font-family: monospace; padding: 2px 6px; border-radius: 9999px; background: #27272a; color: #a1a1aa; border: 1px solid #3f3f46; }
    .toolbar { display: flex; align-items: center; gap: 8px; }
    .tools { display: flex; align-items: center; gap: 4px; background: #18181b; padding: 3px; border-radius: 10px; border: 1px solid #27272a; }
    .tool-btn { width: 32px; height: 32px; border-radius: 7px; border: none; background: transparent; color: #a1a1aa; display: flex; align-items: center; justify-content: center; cursor: pointer; }
    .tool-btn.active { background: #27272a; color: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.4); }
    .color-picker { display: flex; align-items: center; gap: 5px; margin: 0 4px; }
    .color-swatch { width: 18px; height: 18px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; }
    .color-swatch.active { border-color: #fff; transform: scale(1.15); }
    button.action-btn { background: #27272a; color: #e4e4e7; border: 1px solid #3f3f46; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 5px; }
    button.primary { background: #f4f4f5; color: #09090b; font-weight: 600; border: none; box-shadow: 0 2px 8px rgba(255,255,255,0.15); }
    button.primary:active { transform: scale(0.97); }
    canvas { display: block; width: 100vw; height: calc(100vh - 52px); background: #07080a; touch-action: none; cursor: crosshair; }
    #toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%) translateY(50px); background: #18181b; color: #f4f4f5; padding: 8px 16px; border-radius: 20px; font-size: 12px; border: 1px solid #3f3f46; box-shadow: 0 8px 24px rgba(0,0,0,0.7); opacity: 0; transition: all 0.25s ease; pointer-events: none; z-index: 100; }
    #toast.show { transform: translateX(-50%) translateY(0); opacity: 1; }
  </style>
</head>
<body>
  <header>
    <div class="title-group">
      <span class="status-dot"></span>
      <h1>ResearchLoom Stylus Pad</h1>
      <span class="badge" id="pressure-stat">Stylus Ready</span>
    </div>

    <div class="toolbar">
      <div class="tools">
        <button type="button" class="tool-btn active" id="pen-btn" onclick="setMode('pen')" title="Pen">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
        </button>
        <button type="button" class="tool-btn" id="eraser-btn" onclick="setMode('eraser')" title="Eraser">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>
        </button>
      </div>

      <div class="color-picker">
        <div class="color-swatch active" style="background:#ffffff;" onclick="setColor('#ffffff', this)"></div>
        <div class="color-swatch" style="background:#38bdf8;" onclick="setColor('#38bdf8', this)"></div>
        <div class="color-swatch" style="background:#34d399;" onclick="setColor('#34d399', this)"></div>
        <div class="color-swatch" style="background:#fbbf24;" onclick="setColor('#fbbf24', this)"></div>
        <div class="color-swatch" style="background:#f43f5e;" onclick="setColor('#f43f5e', this)"></div>
      </div>

      <button type="button" class="action-btn" onclick="clearCanvas()">Clear</button>
      <button type="button" class="action-btn primary" onclick="sendToResearchLoom()">
        <span>Transmit to PC</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
      </button>
    </div>
  </header>

  <canvas id="pad"></canvas>
  <div id="toast">Transmitted to ResearchLoom</div>

  <script>
    const canvas = document.getElementById('pad');
    const ctx = canvas.getContext('2d');
    const pressureStat = document.getElementById('pressure-stat');
    const toast = document.getElementById('toast');

    let currentMode = 'pen';
    let currentColor = '#ffffff';
    let baseLineWidth = 2.5;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = (window.innerHeight - 52) * dpr;
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
    window.addEventListener('resize', resize);
    resize();

    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    function showToast(msg) {
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2200);
    }

    function setMode(mode) {
      currentMode = mode;
      document.getElementById('pen-btn').classList.toggle('active', mode === 'pen');
      document.getElementById('eraser-btn').classList.toggle('active', mode === 'eraser');
    }

    function setColor(hex, el) {
      currentColor = hex;
      setMode('pen');
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      el.classList.add('active');
    }

    function handlePointerDown(e) {
      // Reject non-primary or palm contact if stylus is active
      if (e.pointerType === 'pen') {
        pressureStat.textContent = 'Stylus Active (' + Math.round((e.pressure || 0.5) * 100) + '%)';
      }
      isDrawing = true;
      lastX = e.clientX;
      lastY = e.clientY - 52;
    }

    function handlePointerMove(e) {
      if (!isDrawing) return;
      const x = e.clientX;
      const y = e.clientY - 52;

      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);

      if (currentMode === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = 26;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = currentColor;
        // Natural pressure dynamics for Apple Pencil & S-Pen
        const pressure = (e.pressure !== undefined && e.pressure > 0) ? e.pressure : 0.5;
        ctx.lineWidth = baseLineWidth * (0.4 + pressure * 1.6);
        if (e.pointerType === 'pen') {
          pressureStat.textContent = 'Stylus Pressure: ' + Math.round(pressure * 100) + '%';
        }
      }

      ctx.stroke();
      lastX = x;
      lastY = y;
    }

    function handlePointerUp(e) {
      isDrawing = false;
      if (e.pointerType === 'pen') {
        pressureStat.textContent = 'Stylus Ready';
      }
    }

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointercancel', handlePointerUp);

    function clearCanvas() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      showToast('Canvas Cleared');
    }

    async function sendToResearchLoom() {
      const dataUrl = canvas.toDataURL('image/png');
      try {
        const resp = await fetch('/api/tablet/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_data: dataUrl })
        });
        if (resp.ok) {
          showToast('Drawing transmitted to ResearchLoom on PC!');
        } else {
          showToast('Error transmitting drawing');
        }
      } catch (err) {
        showToast('Connection error: ' + err);
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
    return {"status": "ok", "version": "4.3.8"}

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

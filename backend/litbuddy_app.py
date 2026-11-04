"""
LitBuddy Standalone Desktop Application — Native Windows Window (pywebview).
Launches FastAPI backend as a local server thread, then opens a dedicated native
application window using pywebview (WebView2 / Edge Chromium — built into Windows 10/11).

FIX: Shows an animated HTML splash screen while the backend initialises.
     The splash page polls /api/health every 800ms and navigates once the server is up.
     This eliminates the "can't reach this page" error on first launch.
"""
import os
import sys
import time
import threading
import socket
import uvicorn

# ── Path Resolution ──────────────────────────────────────────────────────────
if getattr(sys, "frozen", False):
    BASE_DIR = os.path.dirname(sys.executable)
    MEIPASS_DIR = getattr(sys, "_MEIPASS", BASE_DIR)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    MEIPASS_DIR = BASE_DIR

if MEIPASS_DIR not in sys.path:
    sys.path.insert(0, MEIPASS_DIR)

# ── Persistent data directories ──────────────────────────────────────────────
# On Linux, support standard XDG directory structure if not in portable folder
if sys.platform.startswith("linux") and not os.access(BASE_DIR, os.W_OK):
    xdg_data = os.environ.get("XDG_DATA_HOME", os.path.expanduser("~/.local/share"))
    APP_DATA_DIR = os.path.join(xdg_data, "ResearchLoom", "app_data")
    PAPERS_DIR = os.path.join(xdg_data, "ResearchLoom", "ResearchLoom Papers")
else:
    APP_DATA_DIR = os.path.join(BASE_DIR, "app_data")
    PAPERS_DIR = os.path.join(BASE_DIR, "ResearchLoom Papers")

os.makedirs(APP_DATA_DIR, exist_ok=True)
os.makedirs(PAPERS_DIR, exist_ok=True)
os.makedirs(os.path.join(APP_DATA_DIR, "figures"), exist_ok=True)

PORT = 8000
ICON_PATH = os.path.join(BASE_DIR, "icon.ico") if getattr(sys, "frozen", False) \
    else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "icon.ico")


# ── Splash HTML — shown while backend is starting ───────────────────────────
SPLASH_HTML = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>LitBuddy — Starting...</title>
  <style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{
      background: #131314;
      color: #e3e3e3;
      font-family: -apple-system, 'Segoe UI', sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      gap: 32px;
      user-select: none;
    }}
    .logo {{
      width: 96px;
      height: 96px;
      border-radius: 22px;
      background: #0c0d10;
      border: 1.5px solid #23262d;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 16px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
      animation: pulse 2.5s ease-in-out infinite;
    }}
    @keyframes pulse {{
      0%,100% {{ transform: scale(1); box-shadow: 0 16px 40px rgba(0,0,0,0.6); }}
      50%  {{ transform: scale(1.02); box-shadow: 0 20px 48px rgba(0,0,0,0.8), 0 0 20px rgba(255,255,255,0.06); }}
    }}
    h1 {{
      font-size: 24px;
      font-weight: 600;
      letter-spacing: -0.5px;
      color: #f8fafc;
    }}
    .sub {{
      font-size: 13px;
      color: #64748b;
      letter-spacing: 0.2px;
    }}
    .dots {{
      display: flex;
      gap: 8px;
    }}
    .dot {{
      width: 7px; height: 7px;
      border-radius: 50%;
      background: #94a3b8;
      animation: bounce 1.4s ease-in-out infinite;
    }}
    .dot:nth-child(2) {{ animation-delay: 0.16s; }}
    .dot:nth-child(3) {{ animation-delay: 0.32s; }}
    @keyframes bounce {{
      0%,80%,100% {{ transform: scale(0.7); opacity: 0.3; }}
      40% {{ transform: scale(1.0); opacity: 1; }}
    }}
    .status {{ font-size: 12px; color: #475569; margin-top: -16px; }}
  </style>
</head>
<body>
  <div class="logo">
    <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="splash-silver" x1="16" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FFFFFF" />
          <stop offset="50%" stop-color="#E2E8F0" />
          <stop offset="100%" stop-color="#94A3B8" />
        </linearGradient>
      </defs>
      <path d="M13 21L32 27.5L51 21V43.5L32 50L13 43.5V21Z" stroke="#334155" stroke-width="2" stroke-linejoin="round" fill="#13161C"/>
      <path d="M17 18L32 24.5L47 18V41L32 47.5L17 41V18Z" stroke="url(#splash-silver)" stroke-width="2.5" stroke-linejoin="round" fill="#181B22"/>
      <path d="M32 24.5V47.5" stroke="url(#splash-silver)" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M22 23V36.5H29" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M35 24.5L43 32L35 39.5" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M35 32H41.5" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
  </div>
  <div style="text-align:center;display:flex;flex-direction:column;gap:8px;align-items:center">
    <h1>ResearchLoom</h1>
    <p class="sub">Samhita (संहिता) — Autonomous Academic Synthesis &amp; Vault</p>
  </div>
  <div class="dots">
    <div class="dot"></div><div class="dot"></div><div class="dot"></div>
  </div>
  <p class="status" id="msg">Initializing backend...</p>
  <script>
    var attempts = 0;
    var maxAttempts = 60;  // 60 × 800ms = 48 seconds max
    function checkReady() {{
      attempts++;
      document.getElementById('msg').textContent =
        'Starting services... (' + attempts + 's)';
      fetch('http://127.0.0.1:{PORT}/api/health')
        .then(function(r) {{
          if (r.ok || r.status === 200 || r.status === 404) {{
            // Server is up — navigate to the app
            document.getElementById('msg').textContent = 'Ready! Loading app...';
            setTimeout(function() {{
              window.location = 'http://127.0.0.1:{PORT}/';
            }}, 300);
          }} else {{
            if (attempts < maxAttempts) setTimeout(checkReady, 800);
          }}
        }})
        .catch(function() {{
          if (attempts < maxAttempts) setTimeout(checkReady, 800);
          else document.getElementById('msg').textContent = 'Backend failed to start. Please restart.';
        }});
    }}
    // Start polling after 1s initial delay
    setTimeout(checkReady, 1000);
  </script>
</body>
</html>"""


def _start_backend():
    """Start the FastAPI/Uvicorn server in a background daemon thread with logging."""
    log_path = os.path.join(APP_DATA_DIR, "backend_startup.log")

    # In windowless PyInstaller (console=False), sys.stdout/sys.stderr can be None,
    # causing uvicorn's ColourizedFormatter to fail on stream.isatty.
    class NullWriter:
        def write(self, s): pass
        def flush(self): pass
        def isatty(self): return False

    if sys.stdout is None:
        sys.stdout = NullWriter()
    if sys.stderr is None:
        sys.stderr = NullWriter()

    # Plain logging config dictionary without uvicorn's ColourizedFormatter
    safe_log_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "standard": {
                "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
            },
        },
        "handlers": {
            "default": {
                "class": "logging.NullHandler",
            },
        },
        "loggers": {
            "uvicorn": {"handlers": ["default"], "level": "WARNING"},
            "uvicorn.error": {"handlers": ["default"], "level": "WARNING"},
            "uvicorn.access": {"handlers": ["default"], "level": "WARNING"},
        },
    }

    try:
        with open(log_path, "w", encoding="utf-8") as f:
            f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Starting LitBuddy backend on port {PORT}...\n")
        from app.main import app as fastapi_app
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] app.main imported successfully. Launching uvicorn...\n")

        config = uvicorn.Config(
            fastapi_app,
            host="127.0.0.1",
            port=PORT,
            log_config=safe_log_config,
            access_log=False
        )
        server = uvicorn.Server(config)
        server.run()
    except Exception as e:
        import traceback
        err_msg = traceback.format_exc()
        print(f"[Backend Fatal Error]: {err_msg}")
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"\n[{time.strftime('%Y-%m-%d %H:%M:%S')}] FATAL STARTUP ERROR:\n{err_msg}\n")


def _is_port_open(port: int, timeout: float = 0.5) -> bool:
    """Fast TCP socket check — much faster than HTTP polling."""
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=timeout):
            return True
    except OSError:
        return False


def main():
    print("=" * 65)
    print("  ResearchLoom — Autonomous Academic Literature Review & Vault")
    print("  Version: 4.3.6 (System Tray Daemon & Desktop Edition)")
    print(f"  Backend: http://127.0.0.1:{PORT}")
    print(f"  Data:    {APP_DATA_DIR}")
    print("=" * 65)

    # ── Start backend in daemon thread ───────────────────────────────────────
    backend_thread = threading.Thread(target=_start_backend, daemon=True)
    backend_thread.start()

    # ── System Tray & Window Lifecycle ───────────────────────────────────────
    tray_icon = None
    window_ref = [None]
    is_terminating = [False]

    def _restore_window():
        if window_ref[0]:
            try:
                window_ref[0].show()
                window_ref[0].restore()
            except Exception as e:
                print(f"[Window Restore] {e}")

    # Register wake callback with clipper router
    try:
        from app.routers.clipper import register_window_restore_callback
        register_window_restore_callback(_restore_window)
    except Exception as e:
        print(f"[Clipper Register] {e}")

    def _setup_system_tray(icon_image_path):
        nonlocal tray_icon
        try:
            import pystray
            from PIL import Image

            # Generate or load tray icon image
            if icon_image_path and os.path.exists(icon_image_path):
                img = Image.open(icon_image_path)
            else:
                img = Image.new("RGBA", (64, 64), color=(37, 99, 235, 255))

            def on_open(icon, item):
                _restore_window()

            def on_browser(icon, item):
                import webbrowser
                webbrowser.open(f"http://127.0.0.1:{PORT}/")

            def on_exit(icon, item):
                is_terminating[0] = True
                icon.stop()
                if window_ref[0]:
                    try:
                        window_ref[0].destroy()
                    except Exception:
                        pass
                os._exit(0)

            menu = pystray.Menu(
                pystray.MenuItem("Open ResearchLoom", on_open, default=True),
                pystray.MenuItem("Open Web Interface", on_browser),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("Quit ResearchLoom", on_exit)
            )

            tray_icon = pystray.Icon("ResearchLoom", img, "ResearchLoom (Background Active)", menu)
            threading.Thread(target=tray_icon.run, daemon=True).start()
        except Exception as e:
            print(f"[System Tray Warning] Could not initialize system tray: {e}")

    # ── Open native desktop window via pywebview ─────────────────────────────
    try:
        import webview

        # Allow HTML5 / Blob / Excel / CSV file downloads in pywebview WebView2 window
        webview.settings['ALLOW_DOWNLOADS'] = True

        # Resolve icon path
        icon = None
        for candidate in [
            ICON_PATH,
            os.path.join(BASE_DIR, "icon.png"),
            os.path.join(BASE_DIR, "icon.ico"),
            os.path.join(MEIPASS_DIR, "icon.png"),
            os.path.join(MEIPASS_DIR, "icon.ico"),
        ]:
            if os.path.exists(candidate):
                icon = candidate
                break

        _setup_system_tray(icon)

        window = webview.create_window(
            title="ResearchLoom (Samhita)",
            html=SPLASH_HTML,
            width=1360,
            height=860,
            resizable=True,
            min_size=(960, 640),
            background_color="#131314",
            text_select=True,
        )
        window_ref[0] = window

        def on_window_closing():
            if not is_terminating[0]:
                try:
                    # Hide window instead of exiting so backend stays active for Loom Clipper
                    window.hide()
                    return False # Cancel destruction
                except Exception:
                    return True
            return True

        window.events.closing += on_window_closing

        def _apply_windows_dark_titlebar():
            if sys.platform == "win32":
                import ctypes
                try:
                    if window.native and hasattr(window.native, "Handle"):
                        hwnd = int(window.native.Handle.ToInt64())
                    else:
                        hwnd = ctypes.windll.user32.FindWindowW(None, "ResearchLoom (Samhita)")
                        if not hwnd:
                            hwnd = ctypes.windll.user32.FindWindowW(None, "LitBuddy")
                    if hwnd:
                        val = ctypes.c_int(1)
                        ctypes.windll.dwmapi.DwmSetWindowAttribute(hwnd, 20, ctypes.byref(val), ctypes.sizeof(val))
                        ctypes.windll.dwmapi.DwmSetWindowAttribute(hwnd, 19, ctypes.byref(val), ctypes.sizeof(val))
                        caption_color = ctypes.c_int(0x00161312)
                        ctypes.windll.dwmapi.DwmSetWindowAttribute(hwnd, 35, ctypes.byref(caption_color), ctypes.sizeof(caption_color))
                        text_color = ctypes.c_int(0x00E3E3E3)
                        ctypes.windll.dwmapi.DwmSetWindowAttribute(hwnd, 36, ctypes.byref(text_color), ctypes.sizeof(text_color))
                except Exception as e:
                    print(f"[Titlebar Styling] {e}")
            elif sys.platform.startswith("linux"):
                try:
                    import gi
                    gi.require_version('Gtk', '3.0')
                    from gi.repository import Gtk
                    settings = Gtk.Settings.get_default()
                    if settings:
                        settings.set_property("gtk-application-prefer-dark-theme", True)
                except Exception:
                    pass

        window.events.shown += _apply_windows_dark_titlebar

        # pywebview start
        webview.start(
            debug=False,
            private_mode=False,
            storage_path=os.path.join(APP_DATA_DIR, "webview_storage"),
            **({"icon": icon} if icon else {}),
        )

    except ImportError:
        print("[ResearchLoom] pywebview not available — running headless backend.")
        for _ in range(60):
            if _is_port_open(PORT):
                break
            time.sleep(0.5)
        import webbrowser
        webbrowser.open(f"http://127.0.0.1:{PORT}/")
        backend_thread.join()


if __name__ == "__main__":
    main()

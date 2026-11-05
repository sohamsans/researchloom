import os
import sys
import re
import platform
import asyncio
import httpx
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/updater", tags=["In-App Auto-Update Engine"])

CURRENT_VERSION = "4.3.7"
GITHUB_REPO = "sohamsans/researchloom"
GITHUB_RELEASES_URL = f"https://api.github.com/repos/{GITHUB_REPO}/releases/latest"

# Global update download state
download_progress = {
    "status": "idle",       # idle, downloading, ready, error
    "percent": 0,
    "downloaded_bytes": 0,
    "total_bytes": 0,
    "file_path": None,
    "error_message": None,
    "target_version": None
}

class CheckUpdateResponse(BaseModel):
    current_version: str
    latest_version: str
    update_available: bool
    release_name: str
    release_notes: str
    published_at: str
    download_url: Optional[str]
    asset_name: Optional[str]
    asset_size_bytes: int

def parse_semver(v: str) -> tuple:
    """Parse semver string into comparable tuple: 'v4.3.6' -> (4, 3, 6)."""
    clean = re.sub(r'^[^\d]*', '', v).split('-')[0].split('+')[0]
    parts = clean.split('.')
    nums = []
    for p in parts:
        try:
            nums.append(int(p))
        except ValueError:
            nums.append(0)
    while len(nums) < 3:
        nums.append(0)
    return tuple(nums[:3])

def get_platform_asset_match(assets: list) -> Optional[dict]:
    """Find the matching binary asset for the current OS and architecture."""
    current_os = platform.system().lower() # 'windows', 'linux', 'darwin'
    machine = platform.machine().lower()   # 'amd64', 'x86_64', 'arm64', 'aarch64'

    for a in assets:
        name = a.get("name", "").lower()
        if "windows" in current_os or sys.platform == "win32":
            if name.endswith("setup.exe") or (name.startswith("researchloom") and name.endswith(".exe")):
                return a
        elif "darwin" in current_os:
            if name.endswith(".dmg"):
                return a
        elif "linux" in current_os:
            if name.endswith(".appimage"):
                return a

    # Fallback to first non-source asset
    for a in assets:
        if not a.get("name", "").endswith((".zip", ".tar.gz")):
            return a
    return assets[0] if assets else None

@router.get("/check", response_model=CheckUpdateResponse)
async def check_for_updates():
    """
    Query the official GitHub API to check if a newer version of ResearchLoom is published.
    Returns changelog notes, version comparisons, and direct asset download links.
    """
    headers = {"User-Agent": "ResearchLoom-Updater"}
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        try:
            res = await client.get(GITHUB_RELEASES_URL, headers=headers)
            if res.status_code != 200:
                raise HTTPException(status_code=502, detail="Failed to retrieve latest release information from GitHub")
            data = res.json()
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"Network error querying release feed: {str(e)}")

    latest_tag = data.get("tag_name", "v0.0.0")
    curr_v = parse_semver(CURRENT_VERSION)
    latest_v = parse_semver(latest_tag)

    is_newer = latest_v > curr_v
    matched_asset = get_platform_asset_match(data.get("assets", []))

    return CheckUpdateResponse(
        current_version=CURRENT_VERSION,
        latest_version=latest_tag.lstrip("v"),
        update_available=is_newer,
        release_name=data.get("name", f"ResearchLoom {latest_tag}"),
        release_notes=data.get("body", "No release notes provided."),
        published_at=data.get("published_at", ""),
        download_url=matched_asset.get("browser_download_url") if matched_asset else None,
        asset_name=matched_asset.get("name") if matched_asset else None,
        asset_size_bytes=matched_asset.get("size", 0) if matched_asset else 0
    )

@router.get("/status")
async def get_download_status():
    """Poll current background download progress."""
    return download_progress

ALLOWED_HOSTS = ["github.com", "objects.githubusercontent.com", "api.github.com"]

def validate_release_url(url_str: str) -> str:
    """Validate that the download URL strictly targets official GitHub release assets."""
    from urllib.parse import urlparse
    parsed = urlparse(url_str)
    if parsed.scheme != "https":
        raise HTTPException(status_code=400, detail="Only HTTPS download URLs are permitted")
    if parsed.netloc.lower() not in ALLOWED_HOSTS:
        raise HTTPException(status_code=400, detail="Untrusted download host")
    return url_str

@router.post("/download")
async def start_update_download(asset_url: str, version: str):
    """
    Stream and download the update binary in the background.
    """
    global download_progress
    if download_progress["status"] == "downloading":
        return {"status": "already_downloading"}

    # Strict URL validation against SSRF
    safe_url = validate_release_url(asset_url)

    # Determine destination directory
    app_mod = sys.modules.get('backend.litbuddy_app', None)
    if app_mod and hasattr(app_mod, 'APP_DATA_DIR'):
        app_data = app_mod.APP_DATA_DIR
    elif sys.platform == "win32":
        app_data = os.path.join(os.environ.get("APPDATA", os.path.expanduser("~")), "ResearchLoom", "app_data")
    else:
        app_data = os.path.expanduser("~/.local/share/ResearchLoom/app_data")

    dest_dir = os.path.abspath(os.path.join(app_data, "updates"))
    os.makedirs(dest_dir, exist_ok=True)

    # Sanitize filename strictly against path traversal
    raw_filename = os.path.basename(safe_url.split("?")[0])
    clean_filename = re.sub(r'[^a-zA-Z0-9_.-]', '_', raw_filename)
    if not clean_filename or clean_filename.startswith('.'):
        clean_filename = "ResearchLoom_update.bin"

    dest_path = os.path.abspath(os.path.join(dest_dir, clean_filename))
    if not dest_path.startswith(dest_dir):
        raise HTTPException(status_code=400, detail="Invalid target filename path")

    download_progress = {
        "status": "downloading",
        "percent": 0,
        "downloaded_bytes": 0,
        "total_bytes": 0,
        "file_path": dest_path,
        "error_message": None,
        "target_version": version
    }

    async def _download_worker():
        global download_progress
        headers = {"User-Agent": "ResearchLoom-Updater"}
        try:
            async with httpx.AsyncClient(timeout=300.0, follow_redirects=True) as client:
                async with client.stream("GET", safe_url, headers=headers) as resp:
                    if resp.status_code != 200:
                        download_progress["status"] = "error"
                        download_progress["error_message"] = f"HTTP {resp.status_code} during download"
                        return

                    total = int(resp.headers.get("Content-Length", 0))
                    download_progress["total_bytes"] = total
                    downloaded = 0

                    with open(dest_path, "wb") as f:
                        async for chunk in resp.aiter_bytes(chunk_size=128 * 1024):
                            f.write(chunk)
                            downloaded += len(chunk)
                            download_progress["downloaded_bytes"] = downloaded
                            if total > 0:
                                download_progress["percent"] = round((downloaded / total) * 100, 1)

                    download_progress["status"] = "ready"
                    download_progress["percent"] = 100
        except Exception as e:
            download_progress["status"] = "error"
            download_progress["error_message"] = "Download error occurred"

    asyncio.create_task(_download_worker())
    return {"status": "started", "destination": dest_path}

@router.post("/apply")
async def apply_update():
    """
    Launch installer or replace binary and restart the application cleanly.
    """
    global download_progress
    if download_progress["status"] != "ready" or not download_progress.get("file_path"):
        raise HTTPException(status_code=400, detail="Update is not downloaded or ready to apply")

    file_path = os.path.abspath(download_progress["file_path"])
    
    # Verify file resides inside updates folder
    app_mod = sys.modules.get('backend.litbuddy_app', None)
    if app_mod and hasattr(app_mod, 'APP_DATA_DIR'):
        app_data = app_mod.APP_DATA_DIR
    elif sys.platform == "win32":
        app_data = os.path.join(os.environ.get("APPDATA", os.path.expanduser("~")), "ResearchLoom", "app_data")
    else:
        app_data = os.path.expanduser("~/.local/share/ResearchLoom/app_data")
    expected_dir = os.path.abspath(os.path.join(app_data, "updates"))

    if not file_path.startswith(expected_dir) or not os.path.isfile(file_path):
        raise HTTPException(status_code=400, detail="Invalid executable path")

    # Windows installer execution
    if sys.platform == "win32" and file_path.lower().endswith((".exe", ".msi")):
        import subprocess
        subprocess.Popen([file_path], close_fds=True, shell=False)
        asyncio.get_event_loop().call_later(1.0, lambda: os._exit(0))
        return {"status": "applying", "action": "installer_launched"}
    elif sys.platform.startswith("linux") and file_path.endswith(".AppImage"):
        import subprocess
        import stat
        # Restrict permissions safely to 0700 (user rwx only)
        os.chmod(file_path, stat.S_IRWXU)
        subprocess.Popen([file_path], close_fds=True, shell=False)
        asyncio.get_event_loop().call_later(1.0, lambda: os._exit(0))
        return {"status": "applying", "action": "appimage_launched"}

    return {"status": "manual_action_required", "file_path": file_path}

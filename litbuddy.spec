# -*- mode: python ; coding: utf-8 -*-
import os
import sys

block_cipher = None

project_root = os.path.abspath(SPECPATH)
backend_dir = os.path.join(project_root, 'backend')
frontend_dist = os.path.join(project_root, 'frontend', 'dist')

added_datas = [
    (frontend_dist, 'frontend_dist'),
    (os.path.join(backend_dir, 'app'), 'app'),
    (os.path.join(project_root, 'icon.ico'), '.'),   # Bundle icon next to exe
]

hidden_imports = [
    # Uvicorn
    'uvicorn',
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    # FastAPI / Starlette
    'fastapi',
    'starlette',
    'pydantic',
    # HTTP
    'httpx',
    # PDF
    'fitz',
    'pymupdf',
    # Data
    'pandas',
    'openpyxl',
    # Database
    'sqlalchemy',
    'sqlalchemy.dialects.sqlite',
    'aiosqlite',
    # Security
    'cryptography',
    'cryptography.fernet',
    # LLM providers
    'groq',
    'google.genai',
    'anthropic',
    'openai',
    # System Tray & Background Agent
    'pystray',
    'pystray._win32',
    'PIL',
    'PIL.Image',
    'PIL.ImageFilter',
    # Routers
    'app.routers.references',
    'app.routers.vault',
    'app.routers.review',
    'app.routers.export',
    'app.routers.assistant',
    'app.routers.auth',
    'app.routers.notes',
    'app.routers.flow',
    'app.routers.tablet',
    'app.routers.stats',
    'app.routers.calc',
    'app.routers.matrix',
    'app.routers.screening',
    'app.routers.clipper',
    'app.routers.sync',
    'app.routers.updater',
    # Scientific Computing & Statistics
    'scipy',
    'scipy.stats',
    'scipy.signal',
    # Auth
    'email_validator',
    # pywebview (native window)
    'webview',
    'webview.platforms',
    'webview.platforms.winforms',
    'pythonnet',
    'clr',
    # Paper resolvers
    'arxiv',
    'habanero',
    'libgen_api',
    'bs4',
    'bs4.builder',
    'lxml',
    'lxml.etree',
    'PIL',
    'PIL.Image',
    'PIL.ImageFilter',
    # Resolvers package
    'app.services.resolvers',
    'app.services.resolvers.utils',
    'app.services.resolvers.arxiv_resolver',
    'app.services.resolvers.europepmc_resolver',
    'app.services.resolvers.doaj_resolver',
    'app.services.resolvers.core_resolver',
    'app.services.resolvers.habanero_resolver',
    'app.services.resolvers.archive_scholar_resolver',
    'app.services.resolvers.libgen_resolver',
    'app.services.resolvers.scihub_resolver',
    'app.services.resolvers.publisher_scraper',
]

a = Analysis(
    [os.path.join(backend_dir, 'litbuddy_app.py')],
    pathex=[backend_dir],
    binaries=[],
    datas=added_datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'torch',
        'torchvision',
        'torchgen',
        'functorch',
        'transformers',
        'sentence_transformers',
        'nltk',
        'pygame',
        'cv2',
        'matplotlib',
        'tkinter',
        'turtle',
        'pytest',
        'IPython',
        'jupyter',
        'notebook',
        'tensorboard',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='ResearchLoom',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,          # ← No console window — clean native app experience
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    version=os.path.join(project_root, 'file_version_info.txt'),
    icon=os.path.join(project_root, 'icon.ico'),
)

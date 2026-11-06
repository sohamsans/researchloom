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
]

if os.path.exists(os.path.join(project_root, 'icon.ico')):
    added_datas.append((os.path.join(project_root, 'icon.ico'), '.'))

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
    # pywebview macOS / Cocoa backend
    'webview',
    'webview.platforms.cocoa',
    'objc',
    'Foundation',
    'AppKit',
    'WebKit',
    # Routers
    'app.routers.review',
    'app.routers.export',
    'app.routers.assistant',
    'app.routers.auth',
    'app.routers.vault',
    'app.routers.references',
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
    'app.routers.snowball',
    'app.services.snowball_service',
    'app.services.matrix_synthesis_service',
    'app.services.reference_ingestion_service',
    'app.routers.mcp_router',
    'app.services.council_service',
    'app.services.pipeline',
    'app.services.search_engines',
    'app.services.academic_apis',
    'app.services.pdf_service',
    'app.services.llm_service',
    'app.services.assistant_service',
    'app.services.export_service',
    'app.services.vault_service',
    'app.services.offline_token_service',
    'app.db.database',
    'app.db.models',
    'app.models.schemas',
    'app.config',
]

a = Analysis(
    [os.path.join(backend_dir, 'litbuddy_app.py')],
    pathex=[project_root, backend_dir],
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
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

app = BUNDLE(
    exe,
    name='ResearchLoom.app',
    icon=os.path.join(project_root, 'icon.icns') if os.path.exists(os.path.join(project_root, 'icon.icns')) else None,
    bundle_identifier='com.sohamsans.researchloom',
    info_plist={
        'CFBundleName': 'ResearchLoom',
        'CFBundleDisplayName': 'ResearchLoom (Samhita)',
        'CFBundleVersion': '4.3.1',
        'CFBundleShortVersionString': '4.3.1',
        'NSHighResolutionCapable': 'True',
        'NSRequiresAquaSystemAppearance': 'False',
        'LSMinimumSystemVersion': '11.0',
    }
)

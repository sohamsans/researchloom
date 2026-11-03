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

if os.path.exists(os.path.join(project_root, 'icon.png')):
    added_datas.append((os.path.join(project_root, 'icon.png'), '.'))
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
    # pywebview Linux / GTK / WebKit2 / Qt backends
    'webview',
    'webview.platforms.gtk',
    'webview.platforms.qt',
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
    # Services & Resolvers
    'app.services.document_vault_service',
    'app.services.master_reference_service',
    'app.services.matrix_service',
    'app.services.prisma_service',
    'app.services.resolvers.openaccess_button_resolver',
    'app.services.resolvers.zenodo_ssrn_resolver',
    'app.services.resolvers.libgen_resolver',
    'app.services.resolvers.scihub_resolver',
    'app.services.resolvers.ipfs_resolver',
    'app.services.resolvers.publisher_scraper',
    'app.services.resolvers.utils',
    'app.services.export_service',
    'app.services.cache_service',
    'app.services.auth_service',
    'app.services.email_service',
    'app.services.pdf_extractor',
    'app.services.deep_extractor',
    'app.services.academic_search',
    'app.services.llm_provider',
    'app.services.pipeline',
    # DB
    'app.db.database',
    'app.db.models',
    # Models
    'app.models.schemas',
]

a = Analysis(
    [os.path.join(backend_dir, 'litbuddy_app.py')],
    pathex=[backend_dir, project_root],
    binaries=[],
    datas=added_datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'torch', 'torchvision', 'torchaudio',
        'matplotlib', 'seaborn',
        'sympy',
        'IPython', 'jupyter',
        'tkinter',
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
    name='ResearchLoom-linux-x86_64',
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
    icon=os.path.join(project_root, 'icon.png') if os.path.exists(os.path.join(project_root, 'icon.png')) else None,
)

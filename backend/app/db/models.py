import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Boolean, Text, DateTime, ForeignKey
from app.db.database import Base

def get_utc_now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=True)
    name = Column(String(255), nullable=False, default="Researcher")
    password_hash = Column(String(255), nullable=True)
    is_verified = Column(Boolean, default=False)
    verification_code = Column(String(10), nullable=True)
    code_expires_at = Column(DateTime, nullable=True)
    auth_provider = Column(String(50), default="local")

    # Encrypted BYOK Keys
    groq_key_encrypted = Column(Text, nullable=True)
    gemini_key_encrypted = Column(Text, nullable=True)
    openrouter_key_encrypted = Column(Text, nullable=True)
    deepseek_key_encrypted = Column(Text, nullable=True)
    nvidia_key_encrypted = Column(Text, nullable=True)
    custom_api_key_encrypted = Column(Text, nullable=True)
    custom_base_url = Column(String(500), nullable=True)

    selected_model = Column(String(100), default="openai/gpt-oss-20b")
    theme_pref = Column(String(50), default="emerald")
    save_chat_history = Column(Boolean, default=True) # Privacy control toggle
    contribute_public_cache = Column(Boolean, default=True) # Shared paper knowledge base
    created_at = Column(DateTime, default=get_utc_now)

class DiscoveryCache(Base):
    """Tier 1 Cache: Raw candidate paper pool discovered from academic APIs."""
    __tablename__ = "discovery_cache"

    query_hash = Column(String(64), primary_key=True, index=True)
    topic = Column(String(500), nullable=False)
    filters_json = Column(Text, nullable=False)
    papers_json = Column(Text, nullable=False) # JSON serialized List[RawPaperMetadata]
    total_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=get_utc_now)
    access_count = Column(Integer, default=1)

class PaperCache(Base):
    """Tier 2 Cache: Synthesized literature reviews keyed by normalized DOI / Title."""
    __tablename__ = "papers_cache"

    cache_key = Column(String(128), primary_key=True, index=True) # Normalized DOI or title hash
    doi = Column(String(255), nullable=True)
    title = Column(String(500), nullable=False)
    authors_json = Column(Text, nullable=False)
    year = Column(Integer, nullable=True)
    venue = Column(String(255), nullable=True)
    abstract = Column(Text, nullable=True)
    is_oa = Column(Boolean, default=False)
    pdf_url = Column(String(1000), nullable=True)

    # Synthesis fields
    relevance_score = Column(Integer, default=4)
    triage_rationale = Column(Text, nullable=True)
    core_problem = Column(Text, nullable=False)
    methodology = Column(Text, nullable=False)
    key_findings = Column(Text, nullable=False)
    research_gaps = Column(Text, nullable=False)
    critical_remarks = Column(Text, nullable=False)
    source = Column(String(50), default="openalex")

    created_at = Column(DateTime, default=get_utc_now)
    access_count = Column(Integer, default=1)

class PaperDocumentVault(Base):
    """Tier 3 Document Vault: Persistent binary PDF store, extracted layouts, and figure images."""
    __tablename__ = "paper_document_vault"

    id = Column(String(64), primary_key=True, index=True) # Normalized DOI or Title SHA-256
    doi = Column(String(255), index=True, nullable=True)
    title = Column(String(500), nullable=False)
    file_path = Column(String(500), nullable=False) # app_data/pdf_vault/{safe_id}.pdf
    file_size_bytes = Column(Integer, default=0)
    file_sha256 = Column(String(64), nullable=False)
    source_resolved = Column(String(50), default="direct_oa") # arxiv, openalex, unpaywall, europe_pmc, scihub
    
    # Deep Parsing Cache
    parsed_fulltext = Column(Text, nullable=True)
    figures_json = Column(Text, nullable=True) # JSON list of {id, page, img_path, caption}
    sections_json = Column(Text, nullable=True) # JSON dictionary of section contents
    
    download_count = Column(Integer, default=1)
    created_at = Column(DateTime, default=get_utc_now)

class ChatHistory(Base):
    """Saved research assistant conversation transcripts."""
    __tablename__ = "chat_history"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=True)
    title = Column(String(255), default="New Research Inquiry")
    messages_json = Column(Text, nullable=False) # JSON list of messages
    created_at = Column(DateTime, default=get_utc_now)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now)

class ManuscriptNote(Base):
    """Local Research Writing Studio manuscripts (Rich Docs & LaTeX)."""
    __tablename__ = "manuscripts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=True)
    title = Column(String(255), default="Untitled Manuscript")
    mode = Column(String(20), default="rich") # 'rich' (word/docs) or 'latex' (overleaf)
    content = Column(Text, default="") # Markdown/rich text
    latex_source = Column(Text, default="") # Full LaTeX source code
    associated_topic = Column(String(255), nullable=True)
    citations_json = Column(Text, nullable=True) # JSON list of cited DOI / keys
    word_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=get_utc_now)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now)

class FlowCanvas(Base):
    """Flow Map Canvas state containing multi-canvas topics, nodes, and intentional edges."""
    __tablename__ = "flow_canvases"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), index=True, nullable=True)
    title = Column(String(255), default="Untitled Flow Map")
    topic = Column(String(255), default="General Research")
    nodes_json = Column(Text, default="[]")
    edges_json = Column(Text, default="[]")
    viewport_json = Column(Text, default='{"x": 0, "y": 0, "zoom": 1}')
    created_at = Column(DateTime, default=get_utc_now)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now)

class MatrixColumnDefinition(Base):
    """User-defined extraction columns with natural language prompt."""
    __tablename__ = "matrix_column_definitions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = Column(String(64), index=True, default="default_workspace")
    column_name = Column(String(255), nullable=False)
    prompt = Column(Text, nullable=False)
    data_type = Column(String(50), default="string") # string, integer, float, list
    created_at = Column(DateTime, default=get_utc_now)

class MatrixCell(Base):
    """Extracted or edited matrix cell with confidence, provenance, and source coordinates."""
    __tablename__ = "matrix_cells"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = Column(String(64), index=True, default="default_workspace")
    paper_id = Column(String(128), index=True, nullable=False)
    column_id = Column(String(36), index=True, nullable=False)
    value = Column(Text, nullable=False)
    status = Column(String(20), default="reported") # reported, not_reported, inferred
    confidence = Column(String(20), default="high") # high, low, not_mentioned
    source_sentence = Column(Text, nullable=True)
    source_page = Column(Integer, nullable=True)
    bounding_box_json = Column(Text, nullable=True) # [x0, y0, x1, y1]
    is_human_edited = Column(Boolean, default=False)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now)

class ScreeningAuditLog(Base):
    """Systematic PRISMA 2020 screening decision audit trail."""
    __tablename__ = "screening_audit_log"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    workspace_id = Column(String(64), index=True, default="default_workspace")
    paper_id = Column(String(128), index=True, nullable=False)
    paper_title = Column(String(500), nullable=False)
    paper_doi = Column(String(255), nullable=True)
    action = Column(String(20), nullable=False) # 'included', 'excluded', 'maybe'
    exclusion_reason = Column(String(100), nullable=True) # e.g. 'Wrong Population', 'Non-English', 'No Empirical Data', 'Preprint Only'
    stage = Column(String(30), default="screening") # 'identification', 'screening', 'eligibility', 'included'
    reviewer_id = Column(String(100), default="primary_reviewer")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=get_utc_now)


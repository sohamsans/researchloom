from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field, field_validator

class SearchRequest(BaseModel):
    topic: str = Field(..., min_length=2, description="Research query or topic")
    max_results: int = Field(default=50, ge=10, le=250, description="Max candidate papers to fetch (20, 50, 100, 200)")
    offset: int = Field(default=0, ge=0, description="Offset for pagination / bunch retrieval")
    exclude_dois: Optional[List[str]] = Field(default_factory=list, description="List of DOIs or IDs already seen to avoid repetition")
    year_min: Optional[int] = Field(default=None, description="Start publication year")
    year_max: Optional[int] = Field(default=None, description="End publication year")
    no_year_constraint: bool = Field(default=False, description="Ignore year boundaries if True")
    relevance_threshold: int = Field(default=4, ge=1, le=5, description="Min relevance score (1-5) for Stage 2")
    
    # Universal BYOK Provider Configuration
    model_provider: Optional[str] = Field(default="groq", description="groq, gemini, openrouter, deepseek, nvidia, custom")
    model_name: Optional[str] = Field(default=None, description="Model identifier")
    groq_api_key: Optional[str] = Field(default=None, description="Optional runtime Groq API key")
    gemini_api_key: Optional[str] = Field(default=None, description="Optional runtime Gemini API key")
    openrouter_api_key: Optional[str] = Field(default=None, description="Optional runtime OpenRouter API key")
    deepseek_api_key: Optional[str] = Field(default=None, description="Optional runtime DeepSeek API key")
    nvidia_api_key: Optional[str] = Field(default=None, description="Optional runtime NVIDIA NIM API key")
    custom_api_key: Optional[str] = Field(default=None, description="Optional runtime Custom API key")
    custom_base_url: Optional[str] = Field(default=None, description="Optional runtime Custom Base URL")

class AssistantChatMessage(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str

class PaperQARequest(BaseModel):
    query: str
    papers: List[Dict[str, Any]] = Field(default_factory=list, description="Current synthesized or pool papers for grounding")
    chat_history: List[AssistantChatMessage] = Field(default_factory=list, description="Recent conversation turns")
    model_provider: Optional[str] = "groq"
    model_name: Optional[str] = None
    groq_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    deepseek_api_key: Optional[str] = None
    nvidia_api_key: Optional[str] = None
    custom_api_key: Optional[str] = None
    custom_base_url: Optional[str] = None

class PaperQAResponse(BaseModel):
    answer: str
    cited_paper_ids: List[str] = Field(default_factory=list)
    suggested_followups: List[str] = Field(default_factory=list)
    suggested_searches: List[str] = Field(default_factory=list)

    @field_validator('cited_paper_ids', mode='before')
    @classmethod
    def coerce_cited_paper_ids(cls, v):
        if not v:
            return []
        if isinstance(v, list):
            return [str(item) for item in v if item is not None]
        return [str(v)]

class RawPaperMetadata(BaseModel):
    id: str
    title: str
    authors: List[str] = Field(default_factory=list)
    year: Optional[int] = None
    venue: Optional[str] = None
    doi: Optional[str] = None
    abstract: str = ""
    is_oa: bool = False
    pdf_url: Optional[str] = None
    source: str = "openalex"

class TriageItem(BaseModel):
    id: str
    score: int = Field(..., ge=1, le=5)
    rationale: str

class TriageResponse(BaseModel):
    evaluations: List[TriageItem]

class ReviewPaper(BaseModel):
    id: str
    title: str
    year: Optional[int] = None
    authors: List[str] = Field(default_factory=list)
    venue: Optional[str] = ""
    relevance_score: int = 4
    triage_rationale: str = ""
    core_problem: str = Field(description="1-2 sentences on what problem the paper tackles")
    methodology: str = Field(description="Summary of experimental or theoretical approach")
    key_findings: str = Field(description="Top 2-3 empirical or conceptual findings")
    research_gaps: str = Field(description="Specific limitations, unaddressed questions, or future work")
    critical_remarks: str = Field(description="Actionable evaluation: how to use this in a literature review")
    doi_link: str = ""
    pdf_downloaded: bool = False
    source: str = ""

class PipelineResponse(BaseModel):
    topic: str
    total_discovered: int
    total_triaged: int
    total_selected: int
    papers: List[ReviewPaper]
    warnings: List[str] = Field(default_factory=list)

class DiscoveryResponse(BaseModel):
    topic: str
    total_discovered: int
    papers: List[RawPaperMetadata]
    warnings: List[str] = Field(default_factory=list)

class SelectedPipelineRequest(BaseModel):
    topic: str
    selected_papers: List[RawPaperMetadata]
    relevance_threshold: int = Field(default=4, ge=1, le=5)
    max_synthesis_count: Optional[int] = Field(default=None)
    model_provider: Optional[str] = "groq"
    model_name: Optional[str] = None
    groq_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    deepseek_api_key: Optional[str] = None
    nvidia_api_key: Optional[str] = None
    custom_api_key: Optional[str] = None
    custom_base_url: Optional[str] = None

class AssistantChatRequest(BaseModel):
    messages: List[AssistantChatMessage]
    model_provider: Optional[str] = "groq"
    model_name: Optional[str] = None
    groq_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    deepseek_api_key: Optional[str] = None
    nvidia_api_key: Optional[str] = None

class AssistantChatResponse(BaseModel):
    assistant_reply: str
    clarifying_questions: List[str] = Field(default_factory=list)
    suggested_queries: List[str] = Field(default_factory=list)
    suggested_year_min: Optional[int] = None
    suggested_year_max: Optional[int] = None
    recommended_threshold: int = 4

class HealthStatus(BaseModel):
    status: str
    groq_configured: bool
    gemini_configured: bool
    groq_model: str
    gemini_model: str

# ----------------- Auth & BYOK Schemas -----------------

class UserRegisterRequest(BaseModel):
    username: str
    email: str
    password: str
    name: Optional[str] = None

class VerifyCodeRequest(BaseModel):
    email: str
    code: str

class ResendCodeRequest(BaseModel):
    email: str

class RegistrationResponse(BaseModel):
    status: str
    email: str
    message: str

class UserLoginRequest(BaseModel):
    email: str
    password: str

class OAuthDemoRequest(BaseModel):
    provider: str = Field(default="demo", description="'demo', 'google', or 'apple'")
    email: Optional[str] = None
    name: Optional[str] = None

class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    name: str
    username: Optional[str] = None

class UserProfileResponse(BaseModel):
    id: str
    email: str
    username: Optional[str] = None
    name: str
    is_verified: bool = True
    auth_provider: str
    selected_model: str
    theme_pref: str
    save_chat_history: bool = True
    contribute_public_cache: bool = True
    # Masked keys for display
    configured_keys: Dict[str, str]

class UpdateKeysRequest(BaseModel):
    groq_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    deepseek_api_key: Optional[str] = None
    nvidia_api_key: Optional[str] = None
    custom_api_key: Optional[str] = None
    custom_base_url: Optional[str] = None
    selected_model: Optional[str] = None
    theme_pref: Optional[str] = None
    save_chat_history: Optional[bool] = None
    contribute_public_cache: Optional[bool] = None

class SaveChatHistoryRequest(BaseModel):
    title: str = "Literature Inquiry"
    messages: List[AssistantChatMessage]

class ChatHistoryResponse(BaseModel):
    id: str
    title: str
    messages: List[AssistantChatMessage]
    created_at: str

# ----------------- Vault & Bulk Download Schemas -----------------

class VaultPaperItem(BaseModel):
    id: str
    doi: Optional[str] = None
    title: str
    authors: List[str] = Field(default_factory=list)
    year: Optional[int] = None
    venue: Optional[str] = None
    pdf_url: Optional[str] = None
    source: Optional[str] = "openalex"

class VaultFetchRequest(BaseModel):
    paper: VaultPaperItem

class BulkDownloadRequest(BaseModel):
    papers: List[VaultPaperItem]

class VaultStatusResponse(BaseModel):
    is_vaulted: bool
    vault_id: Optional[str] = None
    file_size_bytes: int = 0
    source_resolved: Optional[str] = None
    has_figures: bool = False
    has_fulltext: bool = False

class FigureMetadata(BaseModel):
    id: str
    page: int
    img_url: str
    caption: str = ""

class RefinedSynthesisResponse(BaseModel):
    paper_id: str
    title: str
    fulltext_summary: str
    methodology_deep_dive: str
    mathematical_formulations: List[str] = Field(default_factory=list)
    empirical_benchmarks: str
    unaddressed_limitations: str
    figures: List[FigureMetadata] = Field(default_factory=list)
    bibtex: str

# ----------------- Manuscript & Writing Studio Schemas -----------------

class ManuscriptSaveRequest(BaseModel):
    id: Optional[str] = None
    title: str = "Untitled Manuscript"
    mode: str = "rich" # 'rich' or 'latex'
    content: str = "" # Rich Markdown content
    latex_source: str = "" # Raw LaTeX source
    associated_topic: Optional[str] = None
    citations: List[str] = Field(default_factory=list) # List of cited DOIs / keys
    word_count: int = 0

class ManuscriptResponse(BaseModel):
    id: str
    title: str
    mode: str
    content: str
    latex_source: str
    associated_topic: Optional[str] = None
    citations: List[str] = Field(default_factory=list)
    word_count: int = 0
    created_at: str
    updated_at: str

class ManuscriptListResponse(BaseModel):
    items: List[ManuscriptResponse]
    total: int


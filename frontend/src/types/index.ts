export type ModelProvider = 'groq' | 'gemini' | 'openrouter' | 'deepseek' | 'nvidia' | 'custom';

export interface SearchRequest {
  topic: string;
  max_results: number;
  offset?: number;
  exclude_dois?: string[];
  year_min?: number;
  year_max?: number;
  no_year_constraint?: boolean;
  relevance_threshold: number;
  model_provider?: ModelProvider;
  model_name?: string;
  groq_api_key?: string;
  gemini_api_key?: string;
  openrouter_api_key?: string;
  deepseek_api_key?: string;
  nvidia_api_key?: string;
  custom_api_key?: string;
  custom_base_url?: string;
}

export interface RawPaperMetadata {
  id: string;
  title: string;
  authors: string[];
  year?: number;
  venue?: string;
  doi?: string;
  abstract: string;
  is_oa: boolean;
  pdf_url?: string;
  source: string;
}

export interface DiscoveryResponse {
  topic: string;
  total_discovered: number;
  papers: RawPaperMetadata[];
  warnings: string[];
}

export interface SelectedPipelineRequest {
  topic: string;
  selected_papers: RawPaperMetadata[];
  relevance_threshold: number;
  max_synthesis_count?: number;
  model_provider?: ModelProvider;
  model_name?: string;
  groq_api_key?: string;
  gemini_api_key?: string;
  openrouter_api_key?: string;
  deepseek_api_key?: string;
  nvidia_api_key?: string;
  custom_api_key?: string;
  custom_base_url?: string;
}

export interface ReviewPaper {
  id: string;
  title: string;
  year?: number;
  authors: string[];
  venue?: string;
  relevance_score: number;
  triage_rationale: string;
  core_problem: string;
  methodology: string;
  key_findings: string;
  research_gaps: string;
  critical_remarks: string;
  doi_link: string;
  pdf_downloaded: boolean;
  source: string;
}

export interface PipelineResponse {
  topic: string;
  total_discovered: number;
  total_triaged: number;
  total_selected: number;
  papers: ReviewPaper[];
  warnings: string[];
}

export interface AssistantChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantChatRequest {
  messages: AssistantChatMessage[];
  model_provider?: ModelProvider;
  model_name?: string;
  groq_api_key?: string;
  gemini_api_key?: string;
  openrouter_api_key?: string;
  deepseek_api_key?: string;
  nvidia_api_key?: string;
}

export interface AssistantChatResponse {
  assistant_reply: string;
  clarifying_questions: string[];
  suggested_queries: string[];
  suggested_year_min?: number;
  suggested_year_max?: number;
  recommended_threshold: number;
}

export interface PaperQARequest {
  query: string;
  papers: any[];
  chat_history: AssistantChatMessage[];
  model_provider?: ModelProvider;
  model_name?: string;
  groq_api_key?: string;
  gemini_api_key?: string;
  openrouter_api_key?: string;
  deepseek_api_key?: string;
  nvidia_api_key?: string;
  custom_api_key?: string;
  custom_base_url?: string;
}

export interface PaperQAResponse {
  answer: string;
  cited_paper_ids: string[];
  suggested_followups: string[];
  suggested_searches: string[];
}

export interface HealthStatus {
  status: string;
  groq_configured: boolean;
  gemini_configured: boolean;
  groq_model: string;
  gemini_model: string;
}

export type PipelineStage = 'idle' | 'discovering' | 'triaging' | 'extracting' | 'completed' | 'error';

// ----------------- Auth & BYOK Types -----------------

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  username?: string;
  auth_provider: string;
  selected_model: string;
  theme_pref: string;
  save_chat_history?: boolean;
  contribute_public_cache?: boolean;
  configured_keys: {
    groq?: string;
    gemini?: string;
    openrouter?: string;
    deepseek?: string;
    nvidia?: string;
    custom?: string;
    custom_base_url?: string;
  };
}

export interface VaultPaperItem {
  id: string;
  doi?: string;
  title: string;
  authors?: string[];
  year?: number;
  venue?: string;
  pdf_url?: string;
  source?: string;
}

export interface VaultStatusResponse {
  is_vaulted: boolean;
  vault_id?: string;
  file_size_bytes?: number;
  source_resolved?: string;
  has_figures?: boolean;
  has_fulltext?: boolean;
}

export interface FigureMetadata {
  id: string;
  page: number;
  img_url: string;
  caption: string;
}

export interface RefinedSynthesisResponse {
  paper_id: string;
  title: string;
  fulltext_summary: string;
  methodology_deep_dive: string;
  mathematical_formulations: string[];
  empirical_benchmarks: string;
  unaddressed_limitations: string;
  figures: FigureMetadata[];
  bibtex: string;
  visual_synthesis?: string;
}

export interface ProviderModelInfo {
  id: string;
  name: string;
  cost: string;
}

export interface ProviderItem {
  id: ModelProvider;
  name: string;
  tier: string;
  default_model: string;
  models: ProviderModelInfo[];
  signup_url: string;
  instructions: string;
  quota_estimate: string;
  is_free: boolean;
}

export interface SecurityAssurance {
  title: string;
  points: string[];
}

export interface ProvidersInfoResponse {
  providers: ProviderItem[];
  security_assurance: SecurityAssurance;
}

export interface SavedSearchItem {
  query_hash: string;
  topic: string;
  total_count: number;
  created_at: string;
  access_count: number;
}

export interface ChatHistoryRecord {
  id: string;
  title: string;
  messages: AssistantChatMessage[];
  created_at: string;
}

// ----------------- Manuscript & Writing Studio Types -----------------

export type ManuscriptMode = 'rich' | 'latex';

export interface ManuscriptItem {
  id: string;
  title: string;
  mode: ManuscriptMode;
  content: string;
  latex_source: string;
  associated_topic?: string;
  citations: string[];
  word_count: number;
  created_at: string;
  updated_at: string;
}

export interface ManuscriptSaveRequest {
  id?: string;
  title: string;
  mode: ManuscriptMode;
  content: string;
  latex_source: string;
  associated_topic?: string;
  citations: string[];
  word_count?: number;
}

export interface ManuscriptResponse extends ManuscriptItem {}

export interface ManuscriptListResponse {
  items: ManuscriptItem[];
  total: number;
}


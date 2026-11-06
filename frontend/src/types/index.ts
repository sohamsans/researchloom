export type ModelProvider = 'groq' | 'gemini' | 'claude' | 'openai' | 'openrouter' | 'deepseek' | 'nvidia' | 'custom';

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
  claude_api_key?: string;
  openai_api_key?: string;
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
  research_goal?: string;
  selected_papers: RawPaperMetadata[];
  relevance_threshold: number;
  max_synthesis_count?: number;
  model_provider?: ModelProvider;
  model_name?: string;
  groq_api_key?: string;
  gemini_api_key?: string;
  claude_api_key?: string;
  openai_api_key?: string;
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
  claude_api_key?: string;
  openai_api_key?: string;
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
    claude?: string;
    openai?: string;
    openrouter?: string;
    deepseek?: string;
    nvidia?: string;
    custom?: string;
    custom_base_url?: string;
    [key: string]: string | undefined;
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

// ----------------- Evidence Extraction Matrix Types -----------------

export interface MatrixColumnDefinition {
  id: string;
  workspace_id: string;
  column_name: string;
  prompt: string;
  data_type: 'string' | 'integer' | 'float' | 'list';
  created_at?: string;
}

export interface MatrixCellData {
  id: string;
  workspace_id: string;
  paper_id: string;
  column_id: string;
  value: string;
  status: 'reported' | 'not_reported' | 'inferred';
  confidence: 'high' | 'low' | 'not_mentioned';
  source_sentence?: string | null;
  source_page?: number | null;
  bounding_box?: number[] | null;
  is_human_edited: boolean;
  updated_at: string;
}

export interface MatrixFullDataResponse {
  columns: MatrixColumnDefinition[];
  cells: MatrixCellData[];
}

// ----------------- PRISMA 2020 Systematic Screening Types -----------------

export interface ScreeningDecisionRequest {
  workspace_id?: string;
  paper_id: string;
  paper_title: string;
  paper_doi?: string;
  action: 'included' | 'excluded' | 'maybe';
  exclusion_reason?: string;
  stage?: 'identification' | 'screening' | 'eligibility' | 'included';
  reviewer_id?: string;
  notes?: string;
}

export interface ScreeningAuditItem {
  id: string;
  workspace_id: string;
  paper_id: string;
  paper_title: string;
  paper_doi?: string;
  action: 'included' | 'excluded' | 'maybe';
  exclusion_reason?: string;
  stage: string;
  reviewer_id: string;
  notes?: string;
  created_at: string;
}

export interface PRISMAStatsResponse {
  total_identified: number;
  duplicates_removed: number;
  total_screened: number;
  screen_excluded: number;
  screen_excluded_by_reason: Record<string, number>;
  eligibility_assessed: number;
  eligibility_excluded: number;
  eligibility_excluded_by_reason: Record<string, number>;
  total_included: number;
  recent_audit_log: ScreeningAuditItem[];
}

// ----------------- Citation Snowballing Types -----------------

export interface SnowballSeedMetadata {
  openalex_id: string;
  doi?: string;
  title: string;
  year?: number;
  authors: string[];
  cited_by_count: number;
  referenced_works_count: number;
  venue?: string;
  is_oa: boolean;
  oa_url?: string;
}

export interface SnowballPaperItem {
  id: string;
  doi?: string;
  title: string;
  year?: number;
  authors: string[];
  cited_by_count: number;
  venue?: string;
  abstract: string;
  is_oa: boolean;
  oa_url?: string;
  relation: 'predecessor' | 'successor';
  source: string;
}

export interface SnowballResponse {
  seed: SnowballSeedMetadata;
  direction: 'backward' | 'forward';
  total_count: number;
  papers: SnowballPaperItem[];
  warnings: string[];
}

// ----------------- Evidence Matrix Synthesis Types -----------------

export interface MatrixPaperSummary {
  paper_id: string;
  title: string;
  authors: string[];
  year?: number;
  doi?: string;
  abstract?: string;
  extracted_cells?: Record<string, string>;
}

export interface SynthesisDrafterRequest {
  papers: MatrixPaperSummary[];
  synthesis_lens: 'contrastive' | 'discrepancies' | 'consensus' | 'gaps';
  topic: string;
  model_provider?: ModelProvider;
  model_name?: string;
  groq_api_key?: string;
  gemini_api_key?: string;
  claude_api_key?: string;
  openai_api_key?: string;
  openrouter_api_key?: string;
  deepseek_api_key?: string;
  nvidia_api_key?: string;
  custom_api_key?: string;
  custom_base_url?: string;
}

export interface SynthesisParagraph {
  subheading: string;
  text: string;
  cited_keys: string[];
}

export interface SynthesisDrafterResponse {
  section_title: string;
  paragraphs: SynthesisParagraph[];
  full_latex_section: string;
  bibtex_entries: string[];
  model_used: string;
  lens_applied: string;
}

// ----------------- Bibliographic Reference Types -----------------

export interface BibliographicReferenceItem {
  id: string;
  citation_key: string;
  cite_author_year: string;
  entry_type: string;
  title: string;
  authors: string[];
  year?: number;
  venue?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  publisher?: string;
  doi?: string;
  doi_verified: boolean;
  url?: string;
  abstract?: string;
  bibtex_raw?: string;
  collection_name: string;
  source: string;
  is_vaulted: boolean;
  created_at?: string;
}

export interface ReferenceImportResponse {
  total_parsed: number;
  imported_count: number;
  duplicates_merged: number;
  references: BibliographicReferenceItem[];
  warnings: string[];
}

export interface VerifyDOIResponse {
  doi: string;
  verified: boolean;
  title?: string;
  venue?: string;
  year?: number;
  citation_count?: number;
  error?: string;
}


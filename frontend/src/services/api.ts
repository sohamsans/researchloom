import {
  SearchRequest,
  PipelineResponse,
  DiscoveryResponse,
  SelectedPipelineRequest,
  AssistantChatRequest,
  AssistantChatResponse,
  HealthStatus,
  UserProfile,
  ProvidersInfoResponse,
  SavedSearchItem,
  ChatHistoryRecord,
  VaultStatusResponse,
  RefinedSynthesisResponse,
  ManuscriptItem,
  ManuscriptSaveRequest,
  ManuscriptResponse,
  ManuscriptListResponse,
  MatrixColumnDefinition,
  MatrixCellData,
  MatrixFullDataResponse,
  ScreeningDecisionRequest,
  ScreeningAuditItem,
  PRISMAStatsResponse
} from '../types';
import { FALLBACK_PROVIDERS_INFO } from './providersFallback';
import { executeStandaloneDiscover, executeStandalonePipeline } from './standaloneClient';
import { Capacitor } from '@capacitor/core';

const API_BASE = '/api';

function getAuthHeader(token?: string | null): Record<string, string> {
  const t = token || localStorage.getItem('autolit_auth_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function getClientBYOKKeys(): { groq?: string; gemini?: string; claude?: string; openai?: string; openrouter?: string } {
  try {
    const raw = localStorage.getItem('autolit_runtime_keys') || localStorage.getItem('autolit_byok_keys');
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export async function fetchHealthStatus(): Promise<HealthStatus> {
  if (Capacitor.isNativePlatform()) {
    return {
      status: 'healthy',
      groq_configured: true,
      gemini_configured: true,
      groq_model: 'llama-3.1-8b-instant (Standalone Client)',
      gemini_model: 'gemini-1.5-flash (Standalone Client)'
    };
  }
  try {
    const response = await fetch(`${API_BASE}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }
    return response.json();
  } catch {
    return {
      status: 'standalone',
      groq_configured: true,
      gemini_configured: true,
      groq_model: 'llama-3.1-8b-instant (Offline Direct)',
      gemini_model: 'gemini-1.5-flash (Offline Direct)'
    };
  }
}

export async function discoverPapers(request: SearchRequest): Promise<DiscoveryResponse> {
  // If running on native tablet or desktop server unreachable, execute standalone client discovery
  if (Capacitor.isNativePlatform()) {
    return executeStandaloneDiscover(request);
  }

  try {
    const response = await fetch(`${API_BASE}/discover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(request),
    });

    if (response.ok) {
      return response.json();
    }
  } catch {}

  // Graceful standalone fallback
  return executeStandaloneDiscover(request);
}

export async function runSelectedPipeline(request: SelectedPipelineRequest): Promise<PipelineResponse> {
  if (Capacitor.isNativePlatform()) {
    const keys = getClientBYOKKeys();
    return executeStandalonePipeline(request.selected_papers, request.topic, keys, request.model_provider || 'groq');
  }

  try {
    const response = await fetch(`${API_BASE}/pipeline/selected`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(request),
    });

    if (response.ok) {
      return response.json();
    }
  } catch {}

  const keys = getClientBYOKKeys();
  return executeStandalonePipeline(request.selected_papers, request.topic, keys, request.model_provider || 'groq');
}

export async function runReviewPipeline(request: SearchRequest): Promise<PipelineResponse> {
  const response = await fetch(`${API_BASE}/pipeline`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Pipeline execution failed (${response.status})`);
  }

  return response.json();
}

export async function sendAssistantChat(request: AssistantChatRequest): Promise<AssistantChatResponse> {
  const response = await fetch(`${API_BASE}/assistant/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Assistant chat error (${response.status})`);
  }

  return response.json();
}

export async function sendPaperQA(request: {
  query: string;
  papers: any[];
  chat_history: any[];
  model_provider?: string;
  model_name?: string;
  groq_api_key?: string;
  gemini_api_key?: string;
  openrouter_api_key?: string;
  deepseek_api_key?: string;
  nvidia_api_key?: string;
  custom_api_key?: string;
  custom_base_url?: string;
}): Promise<any> {
  const response = await fetch(`${API_BASE}/assistant/paper-qa`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Paper Q&A error (${response.status})`);
  }

  return response.json();
}

// ---------------- Auth & BYOK APIs ----------------

export async function register(username: string, email: string, password: string, name?: string): Promise<{ status: string; email: string; message: string }> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password, name })
  });
  if (!res.ok) {
    let errorMsg = 'Registration failed';
    try {
      const err = await res.json();
      errorMsg = err.detail || err.message || errorMsg;
    } catch {
      const txt = await res.text().catch(() => '');
      if (txt) errorMsg = txt;
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

export async function verifyCode(email: string, code: string): Promise<{ access_token: string; user_id: string; email: string; name: string; username?: string }> {
  const res = await fetch(`${API_BASE}/auth/verify-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Verification failed');
  }
  return res.json();
}

export async function resendCode(email: string): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/auth/resend-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Resend code failed');
  }
  return res.json();
}

export async function login(identifier: string, password: string): Promise<{ access_token: string; user_id: string; email: string; name: string; username?: string }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: identifier, password })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Login failed');
  }
  return res.json();
}

export async function getProfile(token: string): Promise<UserProfile> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error('Failed to fetch user profile');
  }
  return res.json();
}

export async function saveKeys(token: string, keys: Record<string, string>) {
  const res = await fetch(`${API_BASE}/auth/keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(keys)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to save keys');
  }
  return res.json();
}

export async function getProvidersInfo(): Promise<ProvidersInfoResponse> {
  if (Capacitor.isNativePlatform()) {
    return FALLBACK_PROVIDERS_INFO;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${API_BASE}/auth/providers-info`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      return await res.json();
    }
  } catch {}
  return FALLBACK_PROVIDERS_INFO;
}

export async function getChatHistory(token: string): Promise<ChatHistoryRecord[]> {
  const res = await fetch(`${API_BASE}/auth/history`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    return [];
  }
  return res.json();
}

export async function saveChatHistory(token: string, title: string, messages: any[]): Promise<ChatHistoryRecord> {
  const res = await fetch(`${API_BASE}/auth/history`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ title, messages })
  });
  if (!res.ok) {
    throw new Error('Failed to save chat');
  }
  return res.json();
}

export async function deleteChatHistory(token: string, historyId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/history/${historyId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error('Failed to delete chat history');
  }
}

export async function clearAllChatHistory(token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/history`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    throw new Error('Failed to clear chat history');
  }
}

export async function getSavedSearches(): Promise<SavedSearchItem[]> {
  const res = await fetch(`${API_BASE}/auth/saved-searches`);
  if (!res.ok) {
    return [];
  }
  return res.json();
}

export async function deleteSavedSearch(queryHash: string, topic?: string): Promise<void> {
  const url = topic
    ? `${API_BASE}/auth/saved-searches/${encodeURIComponent(queryHash)}?topic=${encodeURIComponent(topic)}`
    : `${API_BASE}/auth/saved-searches/${encodeURIComponent(queryHash)}`;
  const res = await fetch(url, {
    method: 'DELETE'
  });
  if (!res.ok) {
    throw new Error('Failed to delete saved review');
  }
}

// ---------------- Vault & Bulk Download APIs ----------------

export async function checkVaultStatus(paper: any): Promise<VaultStatusResponse> {
  const res = await fetch(`${API_BASE}/vault/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paper })
  });
  if (!res.ok) {
    return { is_vaulted: false };
  }
  return res.json();
}

export async function vaultSinglePaper(paper: any): Promise<{ status: string; vault_id: string; download_url: string }> {
  const res = await fetch(`${API_BASE}/vault/fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paper })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to archive paper in vault.');
  }
  return res.json();
}

export async function batchVaultPapers(papers: any[]): Promise<{
  total: number;
  success: number;
  results: Array<{ id: string; vault_id: string | null; status: string; file_path?: string; error?: string }>;
}> {
  const res = await fetch(`${API_BASE}/vault/batch-fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ papers })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Batch paper fetch failed.');
  }
  return res.json();
}

export function getVaultDownloadUrl(vaultId: string): string {
  return `${API_BASE}/vault/download/${vaultId}`;
}

export function getVaultViewUrl(vaultId: string): string {
  return `${API_BASE}/vault/view/${vaultId}`;
}

export async function bulkDownloadPapers(papers: any[]): Promise<void> {
  const res = await fetch(`${API_BASE}/vault/bulk-download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ papers })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Bulk download failed.');
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `researchloom_collection_${papers.length}_papers.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function fetchRefinedSynthesis(paper: any, provider?: string, modelName?: string): Promise<RefinedSynthesisResponse> {
  const res = await fetch(`${API_BASE}/vault/refine-synthesis?provider=${provider || 'groq'}&model_name=${modelName || ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paper })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Refined synthesis failed.');
  }
  return res.json();
}

export async function listVaultDownloads(): Promise<{
  total_files: number;
  total_bytes: number;
  vault_dir: string;
  items: Array<{
    vault_id: string;
    doi: string | null;
    title: string;
    file_path: string;
    file_size_bytes: number;
    source_resolved: string;
    download_count: number;
    file_exists: boolean;
    created_at: string | null;
    has_figures: boolean;
    has_fulltext: boolean;
  }>;
}> {
  const res = await fetch(`${API_BASE}/vault/downloads`);
  if (!res.ok) {
    return { total_files: 0, total_bytes: 0, vault_dir: '', items: [] };
  }
  return res.json();
}

export async function openVaultFolder(): Promise<void> {
  const res = await fetch(`${API_BASE}/vault/open-folder`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Could not reveal folder.');
  }
}

export async function deleteVaultedFile(vaultId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/vault/item/${vaultId}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to delete file.');
  }
}

export async function syncVaultDisk(): Promise<{
  synced: number;
  already_registered: number;
  skipped_small: number;
  errors: number;
  total_pdf_files: number;
  vault_dir: string;
  message: string;
}> {
  const res = await fetch(`${API_BASE}/vault/sync-disk`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Vault sync failed.');
  }
  return res.json();
}

export async function getAllReferences(params?: {
  search?: string;
  tag?: string;
  year_min?: number;
  year_max?: number;
  only_vaulted?: boolean;
  only_synthesized?: boolean;
}): Promise<{
  total: number;
  total_unfiltered: number;
  vaulted_count: number;
  synthesized_count: number;
  items: any[];
}> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set('search', params.search);
  if (params?.tag) searchParams.set('tag', params.tag);
  if (params?.year_min) searchParams.set('year_min', params.year_min.toString());
  if (params?.year_max) searchParams.set('year_max', params.year_max.toString());
  if (params?.only_vaulted) searchParams.set('only_vaulted', 'true');
  if (params?.only_synthesized) searchParams.set('only_synthesized', 'true');

  const res = await fetch(`${API_BASE}/references/all?${searchParams.toString()}`);
  if (!res.ok) {
    return { total: 0, total_unfiltered: 0, vaulted_count: 0, synthesized_count: 0, items: [] };
  }
  return res.json();
}

export async function exportReferences(format: 'bibtex' | 'ris' = 'bibtex', paperIds?: string[]): Promise<void> {
  const res = await fetch(`${API_BASE}/references/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format, paper_ids: paperIds })
  });
  if (!res.ok) {
    throw new Error('Failed to export references');
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `litbuddy_library.${format === 'ris' ? 'ris' : 'bib'}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// ----------------- Manuscript & Note Studio APIs -----------------

export async function fetchManuscripts(): Promise<ManuscriptListResponse> {
  const response = await fetch(`${API_BASE}/notes`, {
    headers: { ...getAuthHeader() }
  });
  if (!response.ok) {
    throw new Error(`Failed to load manuscripts (${response.status})`);
  }
  return response.json();
}

export async function fetchManuscriptById(id: string): Promise<ManuscriptResponse> {
  const response = await fetch(`${API_BASE}/notes/${id}`, {
    headers: { ...getAuthHeader() }
  });
  if (!response.ok) {
    throw new Error(`Failed to load manuscript (${response.status})`);
  }
  return response.json();
}

export async function saveManuscript(request: ManuscriptSaveRequest): Promise<ManuscriptResponse> {
  const response = await fetch(`${API_BASE}/notes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader()
    },
    body: JSON.stringify(request)
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to save manuscript (${response.status})`);
  }
  return response.json();
}

export async function deleteManuscript(id: string): Promise<{ success: boolean; id: string }> {
  const response = await fetch(`${API_BASE}/notes/${id}`, {
    method: 'DELETE',
    headers: { ...getAuthHeader() }
  });
  if (!response.ok) {
    throw new Error(`Failed to delete manuscript (${response.status})`);
  }
  return response.json();
}

// ----------------- Evidence Extraction Matrix API -----------------

export async function fetchWorkspaceMatrix(workspaceId: string = 'default_workspace'): Promise<MatrixFullDataResponse> {
  const resp = await fetch(`${API_BASE}/matrix/workspace/${workspaceId}`, {
    headers: { ...getAuthHeader() }
  });
  if (!resp.ok) throw new Error('Failed to fetch workspace matrix data');
  return resp.json();
}

export async function createMatrixColumn(
  columnName: string,
  prompt: string,
  dataType: string = 'string',
  workspaceId: string = 'default_workspace'
): Promise<MatrixColumnDefinition> {
  const resp = await fetch(`${API_BASE}/matrix/columns`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({
      workspace_id: workspaceId,
      column_name: columnName,
      prompt,
      data_type: dataType
    })
  });
  if (!resp.ok) throw new Error('Failed to create matrix column');
  return resp.json();
}

export async function deleteMatrixColumn(columnId: string): Promise<{ status: string; id: string }> {
  const resp = await fetch(`${API_BASE}/matrix/columns/${columnId}`, {
    method: 'DELETE',
    headers: { ...getAuthHeader() }
  });
  if (!resp.ok) throw new Error('Failed to delete matrix column');
  return resp.json();
}

export async function extractMatrixCell(params: {
  workspaceId?: string;
  paperId: string;
  paperTitle: string;
  paperDoi?: string;
  columnId: string;
  columnName: string;
  prompt: string;
  dataType?: string;
  modelProvider?: string;
  modelName?: string;
  groqApiKey?: string;
  geminiApiKey?: string;
}): Promise<MatrixCellData> {
  const resp = await fetch(`${API_BASE}/matrix/extract-cell`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({
      workspace_id: params.workspaceId || 'default_workspace',
      paper_id: params.paperId,
      paper_title: params.paperTitle,
      paper_doi: params.paperDoi,
      column_id: params.columnId,
      column_name: params.columnName,
      prompt: params.prompt,
      data_type: params.dataType || 'string',
      model_provider: params.modelProvider,
      model_name: params.modelName,
      groq_api_key: params.groqApiKey,
      gemini_api_key: params.geminiApiKey
    })
  });
  if (!resp.ok) throw new Error('Failed to extract matrix cell');
  return resp.json();
}

export async function updateMatrixCellManually(
  cellId: string,
  update: {
    value: string;
    paper_id?: string;
    column_id?: string;
    workspace_id?: string;
    status?: string;
    confidence?: string;
    source_sentence?: string;
    source_page?: number;
  }
): Promise<MatrixCellData> {
  const resp = await fetch(`${API_BASE}/matrix/cells/${cellId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(update)
  });
  if (!resp.ok) throw new Error('Failed to update matrix cell');
  return resp.json();
}

// ----------------- PRISMA 2020 Screening API -----------------

export async function logScreeningDecision(req: ScreeningDecisionRequest): Promise<ScreeningAuditItem> {
  const resp = await fetch(`${API_BASE}/screening/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify(req)
  });
  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}));
    throw new Error(errData.detail || `HTTP ${resp.status}: Failed to log screening decision`);
  }
  return resp.json();
}

export async function fetchPRISMAFlowStats(workspaceId: string = 'default_workspace'): Promise<PRISMAStatsResponse> {
  const resp = await fetch(`${API_BASE}/screening/prisma-flow/${workspaceId}`, {
    headers: { ...getAuthHeader() }
  });
  if (!resp.ok) throw new Error('Failed to fetch PRISMA flow statistics');
  return resp.json();
}

export async function generateAIFlowMap(topic: string, papers?: any[]): Promise<{
  title: string;
  nodes: any[];
  edges: any[];
}> {
  const byok = getClientBYOKKeys();
  const res = await fetch(`${API_BASE}/flow/generate-ai-map`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({
      topic,
      papers: papers || [],
      groq_api_key: byok.groq,
      gemini_api_key: byok.gemini,
      claude_api_key: (byok as any).claude,
      openai_api_key: (byok as any).openai,
      openrouter_api_key: byok.openrouter
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to generate AI flow map.');
  }
  return res.json();
}

export const api = {
  fetchHealthStatus,
  discoverPapers,
  runSelectedPipeline,
  runReviewPipeline,
  generateAIFlowMap,
  sendAssistantChat,
  sendPaperQA,
  register,
  verifyCode,
  resendCode,
  login,
  getProfile,
  saveKeys,
  getProvidersInfo,
  getChatHistory,
  saveChatHistory,
  getSavedSearches,
  deleteChatHistory,
  clearAllChatHistory,
  deleteSavedSearch,
  checkVaultStatus,
  vaultSinglePaper,
  getVaultDownloadUrl,
  bulkDownloadPapers,
  fetchRefinedSynthesis,
  listVaultDownloads,
  openVaultFolder,
  deleteVaultedFile,
  syncVaultDisk,
  getAllReferences,
  exportReferences,
  fetchManuscripts,
  fetchManuscriptById,
  saveManuscript,
  deleteManuscript
};



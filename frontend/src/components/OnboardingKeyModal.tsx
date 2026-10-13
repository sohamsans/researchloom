import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  ExternalLink,
  ShieldCheck,
  CheckCircle,
  Zap,
  Sparkles,
  Globe,
  Brain,
  Sliders,
  Info,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { ProviderItem, SecurityAssurance } from '../types';

export const OnboardingKeyModal: React.FC = () => {
  const { isKeyModalOpen, closeKeyModal, user, saveBYOKKeys, runtimeKeys, setRuntimeKey } = useAuth();

  const [activeTab, setActiveTab] = useState<'groq' | 'gemini' | 'openrouter' | 'deepseek' | 'nvidia' | 'custom' | 'free-directory' | 'privacy'>('groq');
  const [providersData, setProvidersData] = useState<ProviderItem[]>([]);
  const [securityAssurance, setSecurityAssurance] = useState<SecurityAssurance | null>(null);

  // Form values
  const [keysInput, setKeysInput] = useState<{
    groq: string;
    gemini: string;
    openrouter: string;
    deepseek: string;
    nvidia: string;
    custom: string;
    custom_base_url: string;
  }>({
    groq: '',
    gemini: '',
    openrouter: '',
    deepseek: '',
    nvidia: '',
    custom: '',
    custom_base_url: ''
  });

  // Privacy and caching preferences
  const [privacySettings, setPrivacySettings] = useState<{
    saveChatHistory: boolean;
    contributePublicCache: boolean;
  }>({
    saveChatHistory: true,
    contributePublicCache: true
  });

  const [showPlain, setShowPlain] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isKeyModalOpen) {
      api.getProvidersInfo().then(data => {
        setProvidersData(data.providers);
        setSecurityAssurance(data.security_assurance);
      }).catch(err => console.error('Failed to load providers info:', err));

      if (user) {
        setPrivacySettings({
          saveChatHistory: user.save_chat_history !== false,
          contributePublicCache: user.contribute_public_cache !== false
        });
      }

      if (user?.configured_keys) {
        setKeysInput({
          groq: runtimeKeys.groq || '',
          gemini: runtimeKeys.gemini || '',
          openrouter: runtimeKeys.openrouter || '',
          deepseek: runtimeKeys.deepseek || '',
          nvidia: runtimeKeys.nvidia || '',
          custom: runtimeKeys.custom || '',
          custom_base_url: user.configured_keys.custom_base_url || runtimeKeys.custom_base_url || ''
        });
      }
    }
  }, [isKeyModalOpen, user]);

  if (!isKeyModalOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const payload: Record<string, any> = {
        save_chat_history: privacySettings.saveChatHistory,
        contribute_public_cache: privacySettings.contributePublicCache
      };
      const keyMap: Record<string, string> = {
        groq: keysInput.groq.trim(),
        gemini: keysInput.gemini.trim(),
        openrouter: keysInput.openrouter.trim(),
        deepseek: keysInput.deepseek.trim(),
        nvidia: keysInput.nvidia.trim(),
        custom: keysInput.custom.trim(),
        custom_base_url: keysInput.custom_base_url.trim()
      };

      if (keyMap.groq) payload.groq_api_key = keyMap.groq;
      if (keyMap.gemini) payload.gemini_api_key = keyMap.gemini;
      if (keyMap.openrouter) payload.openrouter_api_key = keyMap.openrouter;
      if (keyMap.deepseek) payload.deepseek_api_key = keyMap.deepseek;
      if (keyMap.nvidia) payload.nvidia_api_key = keyMap.nvidia;
      if (keyMap.custom) payload.custom_api_key = keyMap.custom;
      if (keyMap.custom_base_url) payload.custom_base_url = keyMap.custom_base_url;

      await saveBYOKKeys(payload);

      Object.entries(keyMap).forEach(([k, v]) => {
        setRuntimeKey(k, v);
      });

      // If the current tab being configured has a valid key, explicitly prioritize it
      if (['groq', 'gemini', 'openrouter', 'deepseek', 'nvidia', 'custom'].includes(activeTab) && keyMap[activeTab]) {
        setRuntimeKey(activeTab, keyMap[activeTab]);
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        closeKeyModal();
      }, 1000);
    } catch (err) {
      console.error('Failed to save BYOK keys:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const currentProviderInfo = providersData.find(p => p.id === activeTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-2xl dark:bg-[#1e1f20] bg-white rounded-3xl p-6 shadow-2xl border dark:border-[#3c4043] border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b dark:border-[#3c4043] border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full dark:bg-[#282a2c] bg-slate-100 dark:text-[#8ab4f8] text-[#1a73e8] flex items-center justify-center">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-medium dark:text-[#e3e3e3] text-slate-900 font-sans">
                API Key Credentials & Security
              </h2>
              <p className="text-xs dark:text-[#9aa0a6] text-slate-500">
                Encrypted at rest with AES-256 and client-isolated to your account.
              </p>
            </div>
          </div>
          <button
            onClick={closeKeyModal}
            className="dark:text-[#9aa0a6] text-slate-400 hover:dark:text-white hover:text-black p-1.5 rounded-full hover:dark:bg-[#282a2c] hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Assurance Banner */}
        <div className="my-3 p-3 rounded-2xl dark:bg-[#282a2c] bg-slate-50 border dark:border-[#3c4043] border-slate-200 flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-[#81c995] shrink-0 mt-0.5" />
          <div className="text-xs dark:text-[#c4c7c5] text-slate-700">
            <p className="font-medium text-[#81c995] mb-0.5">
              Client-Isolated Security Guarantee
            </p>
            <p className="dark:text-[#9aa0a6] text-slate-500 text-[11px] leading-relaxed">
              Your keys are encrypted before database persistence. Requests are sent directly to official model endpoints. Keys are never shared, exposed to other users, or used for model training.
            </p>
          </div>
        </div>

        {/* Provider Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b dark:border-[#3c4043] border-slate-200">
          {[
            { id: 'groq', name: 'Groq Cloud', badge: '14.4k/d Free' },
            { id: 'gemini', name: 'Google Gemini', badge: '1.5k/d Free' },
            { id: 'openrouter', name: 'OpenRouter', badge: ':free models' },
            { id: 'deepseek', name: 'DeepSeek', badge: '$0.14/1M' },
            { id: 'nvidia', name: 'NVIDIA NIM', badge: '1,000 Credits' },
            { id: 'custom', name: 'Custom Base URL', badge: 'Self-Hosted' },
            { id: 'privacy', name: 'Privacy & Storage', badge: 'Data Sovereignty' },
            { id: 'free-directory', name: 'Free APIs & Repos', badge: '100% Free' }
          ].map((tab) => {
            const isConfigured = tab.id !== 'free-directory' && tab.id !== 'privacy' && (
              !!(user?.configured_keys as Record<string, string | undefined>)?.[tab.id] ||
              !!(runtimeKeys as Record<string, string | undefined>)?.[tab.id]
            );
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'bg-[#8ab4f8] text-[#131314]'
                    : 'dark:bg-[#131314] bg-slate-100 dark:text-[#c4c7c5] text-slate-700 hover:dark:bg-[#282a2c] hover:bg-slate-200'
                }`}
              >
                <span>{tab.name}</span>
                {isConfigured && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#81c995]" title="Configured" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 text-xs">
          {activeTab === 'privacy' ? (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-[#131314] border border-[#3c4043]">
                <h4 className="font-semibold text-[#8ab4f8] mb-1 flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-[#8ab4f8]" />
                  <span>Privacy, Ephemeral Mode & Data Sovereignty</span>
                </h4>
                <p className="text-[#9aa0a6] text-[11px] leading-relaxed">
                  LitBuddy is built on radical transparency and user agency. You decide whether your queries and synthesis are saved to disk or discarded immediately after your session.
                </p>
              </div>

              {/* Setting 1: Save Chat History & Context */}
              <div className="p-3.5 rounded-2xl bg-[#131314] border border-[#3c4043] flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#e3e3e3] text-xs">Save Chat History & Context</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#8ab4f8]/10 text-[#8ab4f8] border border-[#8ab4f8]/30 font-medium">
                      {privacySettings.saveChatHistory ? 'Persisted' : 'Ephemeral Only'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#9aa0a6] leading-relaxed">
                    When enabled, conversation queries and grounded synthesis are stored securely in your private SQLite database.
                    When disabled, chat history is strictly ephemeral in browser RAM and wiped instantly upon closing the tab.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPrivacySettings(prev => ({ ...prev, saveChatHistory: !prev.saveChatHistory }))}
                  className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none mt-1 ${
                    privacySettings.saveChatHistory ? 'bg-[#81c995]' : 'bg-[#5f6368]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      privacySettings.saveChatHistory ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Setting 2: Contribute to Public Literature Cache */}
              <div className="p-3.5 rounded-2xl bg-[#131314] border border-[#3c4043] flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#e3e3e3] text-xs">Contribute to Public Document Vault</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#81c995]/10 text-[#81c995] border border-[#81c995]/30 font-medium">
                      {privacySettings.contributePublicCache ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#9aa0a6] leading-relaxed">
                    Anonymously share fetched open-access full-text PDFs and extracted diagram metadata with the shared vault.
                    No personal prompts, usernames, or search history are ever shared—only public scientific literature to eliminate redundant API requests for other scholars.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPrivacySettings(prev => ({ ...prev, contributePublicCache: !prev.contributePublicCache }))}
                  className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none mt-1 ${
                    privacySettings.contributePublicCache ? 'bg-[#81c995]' : 'bg-[#5f6368]'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      privacySettings.contributePublicCache ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          ) : activeTab === 'free-directory' ? (
            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-[#131314] border border-[#3c4043]">
                <h4 className="font-semibold text-[#8ab4f8] mb-1">
                  100% Free Cloud LLM APIs & Open Repositories
                </h4>
                <p className="text-[#9aa0a6] text-[11px] leading-relaxed mb-3">
                  Our mission is to maximize research accessibility without charging for API access or locking you into expensive plans. Here are curated repositories, gateways, and services offering free tiers:
                </p>
                
                <div className="space-y-2.5">
                  <div className="p-2.5 rounded-xl bg-[#1e1f20] border border-[#3c4043]">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#e3e3e3]">Groq Cloud Free Tier</span>
                      <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-[#8ab4f8] hover:underline flex items-center gap-1 text-[11px]">
                        console.groq.com <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="text-[#9aa0a6] text-[10px] mt-1">
                      Provides ultra-fast inference with generous free rate limits on `llama-3.3-70b-versatile`. Ultra-fast LPUs with zero credit card required.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#1e1f20] border border-[#3c4043]">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#e3e3e3]">Google AI Studio (Gemini Free)</span>
                      <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[#8ab4f8] hover:underline flex items-center gap-1 text-[11px]">
                        aistudio.google.com <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="text-[#9aa0a6] text-[10px] mt-1">
                      Generous free rate limit of 15 RPM and 1,500 requests daily on `gemini-3.8-flash` with a large token context window.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#1e1f20] border border-[#3c4043]">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#e3e3e3]">OpenRouter Free Endpoints</span>
                      <a href="https://openrouter.ai/models?max_price=0" target="_blank" rel="noreferrer" className="text-[#8ab4f8] hover:underline flex items-center gap-1 text-[11px]">
                        openrouter.ai/models <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="text-[#9aa0a6] text-[10px] mt-1">
                      Models ending with `:free` (like `meta-llama/llama-3.1-8b-instruct:free`) can be queried with zero balance.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#1e1f20] border border-[#3c4043]">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#e3e3e3]">public-apis & Free LLM Repositories</span>
                      <a href="https://github.com/public-apis/public-apis" target="_blank" rel="noreferrer" className="text-[#8ab4f8] hover:underline flex items-center gap-1 text-[11px]">
                        github.com/public-apis <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="text-[#9aa0a6] text-[10px] mt-1">
                      Comprehensive directory of free software, academic endpoints, and machine learning APIs for scientific computing.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : currentProviderInfo ? (
            <div className="space-y-3">
              {/* Quota & Cost Guidance */}
              <div className="p-3 rounded-2xl dark:bg-[#131314] bg-slate-50 border dark:border-[#3c4043] border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold dark:text-[#e3e3e3] text-slate-900">
                    {currentProviderInfo.name} Quota & Pricing
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full dark:bg-[#282a2c] bg-white border dark:border-[#3c4043] border-slate-300 dark:text-[#8ab4f8] text-[#1a73e8] font-medium">
                    {currentProviderInfo.tier}
                  </span>
                </div>
                <p className="dark:text-[#9aa0a6] text-slate-500 text-[11px] leading-relaxed">
                  {currentProviderInfo.quota_estimate}
                </p>
              </div>

              {/* Instructions & 1-Click Link */}
              <div className="p-3 rounded-2xl dark:bg-[#131314] bg-slate-50 border dark:border-[#3c4043] border-slate-200">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold dark:text-[#e3e3e3] text-slate-900 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-[#8ab4f8]" />
                    Get your API key:
                  </span>
                  <a
                    href={currentProviderInfo.signup_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#8ab4f8] hover:underline flex items-center gap-1 font-medium"
                  >
                    <span>Open {currentProviderInfo.name} Console</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <pre className="text-[11px] font-sans dark:text-[#9aa0a6] text-slate-500 whitespace-pre-wrap leading-relaxed">
                  {currentProviderInfo.instructions}
                </pre>
              </div>

              {/* Input Field */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium dark:text-[#e3e3e3] text-slate-800">
                    {currentProviderInfo.name} API Key
                  </label>
                  {user?.configured_keys?.[activeTab] && (
                    <span className="text-[10px] text-[#81c995] font-mono">
                      Saved: {user.configured_keys[activeTab]}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type={showPlain ? 'text' : 'password'}
                    value={keysInput[activeTab]}
                    onChange={(e) => setKeysInput({ ...keysInput, [activeTab]: e.target.value })}
                    placeholder={`Paste key here, e.g. ${activeTab === 'groq' ? 'gsk_...' : activeTab === 'gemini' ? 'AIzaSy...' : 'sk-...'}`}
                    className="w-full px-3.5 py-2.5 rounded-full dark:bg-[#131314] bg-slate-50 border dark:border-[#3c4043] border-slate-300 text-xs font-mono dark:text-white text-slate-900 outline-none focus:border-[#8ab4f8]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPlain(!showPlain)}
                    className="absolute right-3.5 top-2.5 dark:text-[#9aa0a6] text-slate-400 hover:text-white"
                  >
                    {showPlain ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Custom Base URL if custom tab */}
              {activeTab === 'custom' && (
                <div>
                  <label className="block font-medium dark:text-[#e3e3e3] text-slate-800 mb-1">
                    Custom Base URL (OpenAI-compatible)
                  </label>
                  <input
                    type="text"
                    value={keysInput.custom_base_url}
                    onChange={(e) => setKeysInput({ ...keysInput, custom_base_url: e.target.value })}
                    placeholder="https://api.together.xyz/v1 or http://localhost:8000/v1"
                    className="w-full px-3.5 py-2 rounded-full dark:bg-[#131314] bg-slate-50 border dark:border-[#3c4043] border-slate-300 text-xs font-mono dark:text-white text-slate-900 outline-none focus:border-[#8ab4f8]"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="text-center dark:text-[#9aa0a6] text-slate-400 py-6">Loading provider details...</div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t dark:border-[#3c4043] border-slate-200 flex items-center justify-between">
          <div className="text-xs dark:text-[#9aa0a6] text-slate-400">
            {saveSuccess ? (
              <span className="text-[#81c995] flex items-center gap-1 font-medium">
                <CheckCircle className="w-3.5 h-3.5" />
                Keys encrypted & saved securely!
              </span>
            ) : (
              <span>Client-isolated encrypted storage</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={closeKeyModal}
              className="px-4 py-1.5 rounded-full dark:text-[#c4c7c5] text-slate-600 hover:dark:bg-[#282a2c] hover:bg-slate-100 text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-1.5 rounded-full bg-[#8ab4f8] text-[#131314] hover:bg-[#a8c7fa] text-xs font-semibold disabled:opacity-40 transition-colors"
            >
              {isSaving ? 'Encrypting...' : 'Save Keys'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

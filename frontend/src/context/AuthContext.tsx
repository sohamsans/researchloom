import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { UserProfile, ModelProvider } from '../types';

export interface OfflineProfile {
  name: string;
  username: string;
  title: string;
  avatar_color: 'sky' | 'emerald' | 'purple' | 'amber' | 'rose' | 'zinc';
  app_identity?: 'researchloom' | 'samhita';
  save_chat_history?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  offlineProfile: OfflineProfile;
  saveOfflineProfile: (profile: Partial<OfflineProfile>) => void;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Modals state
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  
  isKeyModalOpen: boolean;
  openKeyModal: () => void;
  closeKeyModal: () => void;
  
  isHistoryDrawerOpen: boolean;
  openHistoryDrawer: () => void;
  closeHistoryDrawer: () => void;
  
  // Model & Provider Selection
  activeProvider: ModelProvider;
  setActiveProvider: (p: ModelProvider) => void;
  activeModel: string;
  setActiveModel: (m: string) => void;

  // Runtime API keys (local cache for seamless execution)
  runtimeKeys: Record<string, string>;
  setRuntimeKey: (provider: string, key: string) => void;

  // Compatibility stubs
  loginWithEmail: (identifier: string, pass: string) => Promise<void>;
  registerWithEmail: (username: string, email: string, pass: string, name?: string) => Promise<{ status: string; email: string; message: string; dev_code?: string }>;
  verifyAccountCode: (email: string, code: string) => Promise<void>;
  resendAccountCode: (email: string) => Promise<{ status: string; message: string; dev_code?: string }>;
  logout: () => void;
  saveBYOKKeys: (keys: Record<string, any>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const DEFAULT_PROFILE: OfflineProfile = {
  name: 'Fellow Researcher',
  username: 'researcher',
  title: 'Independent Scholar',
  avatar_color: 'sky',
  app_identity: 'researchloom',
  save_chat_history: true
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [offlineProfile, setOfflineProfile] = useState<OfflineProfile>(() => {
    try {
      const stored = localStorage.getItem('litbuddy_offline_profile');
      if (stored) return { ...DEFAULT_PROFILE, ...JSON.parse(stored) };
    } catch {}
    return DEFAULT_PROFILE;
  });

  const [token] = useState<string | null>('offline_desktop_token');
  const [isLoading] = useState<boolean>(false);

  // Modals
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);

  // Provider & Model State
  const [activeProvider, setActiveProvider] = useState<ModelProvider>(() => {
    return (localStorage.getItem('autolit_active_provider') as ModelProvider) || 'gemini';
  });
  const [activeModel, setActiveModel] = useState<string>(() => {
    const stored = localStorage.getItem('autolit_active_model');
    const p = (localStorage.getItem('autolit_active_provider') as ModelProvider) || 'gemini';
    if (!stored || stored === 'gemini' || stored === 'gemini-1.5-flash-8b' || stored === 'gemini-3.5-flash-lite' || stored === 'gemini-2.0-flash' || stored === 'llama-3.1-8b-instant') {
      const def = p === 'gemini' ? 'gemini-3.8-flash' : 'llama-3.3-70b-versatile';
      localStorage.setItem('autolit_active_model', def);
      return def;
    }
    if (p === 'gemini' && !stored.toLowerCase().startsWith('gemini-')) {
      const def = 'gemini-3.8-flash';
      localStorage.setItem('autolit_active_model', def);
      return def;
    }
    return stored;
  });

  // Runtime API keys state (stored in session or localStorage)
  const [runtimeKeys, setRuntimeKeys] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem('autolit_runtime_keys') || sessionStorage.getItem('autolit_runtime_keys');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Model defaults per provider
  const getProviderDefaultModel = (provider: ModelProvider): string => {
    switch (provider) {
      case 'gemini':
        return 'gemini-3.8-flash';
      case 'groq':
        return 'llama-3.3-70b-versatile';
      case 'openrouter':
        return 'meta-llama/llama-3.3-70b-instruct:free';
      case 'deepseek':
        return 'deepseek-chat';
      case 'nvidia':
        return 'meta/llama-3.1-8b-instruct';
      default:
        return 'gemini-3.8-flash';
    }
  };

  const handleSetActiveProvider = useCallback((p: ModelProvider) => {
    setActiveProvider(p);
    localStorage.setItem('autolit_active_provider', p);
    const defModel = getProviderDefaultModel(p);
    setActiveModel(defModel);
    localStorage.setItem('autolit_active_model', defModel);
  }, []);

  const handleSetActiveModel = useCallback((m: string) => {
    setActiveModel(m);
    localStorage.setItem('autolit_active_model', m);
  }, []);

  // Intelligent auto-switch: if the currently active provider has no key configured,
  // but another provider (like Gemini or Groq) has a valid key, switch to it immediately!
  useEffect(() => {
    const hasCurrentKey = !!runtimeKeys[activeProvider];
    if (!hasCurrentKey) {
      if (runtimeKeys.gemini) {
        handleSetActiveProvider('gemini');
      } else if (runtimeKeys.groq) {
        handleSetActiveProvider('groq');
      } else if (runtimeKeys.openrouter) {
        handleSetActiveProvider('openrouter');
      } else if (runtimeKeys.deepseek) {
        handleSetActiveProvider('deepseek');
      } else if (runtimeKeys.nvidia) {
        handleSetActiveProvider('nvidia');
      }
    }
  }, [runtimeKeys, activeProvider, handleSetActiveProvider]);

  const setRuntimeKey = (provider: string, key: string) => {
    setRuntimeKeys(prev => {
      const next = { ...prev, [provider]: key };
      localStorage.setItem('autolit_runtime_keys', JSON.stringify(next));
      sessionStorage.setItem('autolit_runtime_keys', JSON.stringify(next));
      return next;
    });

    // Auto-switch to newly supplied provider
    if (key.trim()) {
      const p = provider.toLowerCase().trim() as ModelProvider;
      if (['groq', 'gemini', 'openrouter', 'deepseek', 'nvidia', 'custom'].includes(p)) {
        handleSetActiveProvider(p);
      }
    }
  };

  const saveOfflineProfile = useCallback((updates: Partial<OfflineProfile>) => {
    setOfflineProfile(prev => {
      const next = { ...prev, ...updates };
      localStorage.setItem('litbuddy_offline_profile', JSON.stringify(next));
      return next;
    });
  }, []);

  const saveBYOKKeys = useCallback(async (keys: Record<string, any>) => {
    const newKeys: Record<string, string> = {};
    if (keys.groq_api_key !== undefined) newKeys.groq = keys.groq_api_key;
    else if (keys.groq !== undefined) newKeys.groq = keys.groq;

    if (keys.gemini_api_key !== undefined) newKeys.gemini = keys.gemini_api_key;
    else if (keys.gemini !== undefined) newKeys.gemini = keys.gemini;

    if (keys.openrouter_api_key !== undefined) newKeys.openrouter = keys.openrouter_api_key;
    else if (keys.openrouter !== undefined) newKeys.openrouter = keys.openrouter;

    if (keys.deepseek_api_key !== undefined) newKeys.deepseek = keys.deepseek_api_key;
    else if (keys.deepseek !== undefined) newKeys.deepseek = keys.deepseek;

    if (keys.nvidia_api_key !== undefined) newKeys.nvidia = keys.nvidia_api_key;
    else if (keys.nvidia !== undefined) newKeys.nvidia = keys.nvidia;

    if (keys.custom_api_key !== undefined) newKeys.custom = keys.custom_api_key;
    else if (keys.custom !== undefined) newKeys.custom = keys.custom;

    if (keys.custom_base_url !== undefined) newKeys.custom_base_url = keys.custom_base_url;

    setRuntimeKeys(prev => {
      const next = { ...prev, ...newKeys };
      localStorage.setItem('autolit_runtime_keys', JSON.stringify(next));
      sessionStorage.setItem('autolit_runtime_keys', JSON.stringify(next));
      return next;
    });

    // Automatically switch active provider to the newly configured key
    // Priority: If user provided or updated gemini key, switch to gemini; else whichever key is populated
    if (newKeys.gemini && newKeys.gemini.trim()) {
      handleSetActiveProvider('gemini');
    } else if (newKeys.groq && newKeys.groq.trim()) {
      handleSetActiveProvider('groq');
    } else if (newKeys.openrouter && newKeys.openrouter.trim()) {
      handleSetActiveProvider('openrouter');
    } else if (newKeys.deepseek && newKeys.deepseek.trim()) {
      handleSetActiveProvider('deepseek');
    } else if (newKeys.nvidia && newKeys.nvidia.trim()) {
      handleSetActiveProvider('nvidia');
    }
  }, [handleSetActiveProvider]);

  // Adapt offline profile to UserProfile interface for seamless app-wide compatibility
  const user: UserProfile = {
    id: 'offline_user',
    email: `${offlineProfile.username}@litbuddy.offline`,
    username: offlineProfile.username,
    name: offlineProfile.name,
    auth_provider: 'offline',
    selected_model: activeModel,
    theme_pref: 'dark',
    save_chat_history: offlineProfile.save_chat_history ?? true,
    contribute_public_cache: false,
    configured_keys: runtimeKeys
  };

  const refreshProfile = useCallback(async () => {}, []);
  const logout = useCallback(() => {}, []);
  const loginWithEmail = useCallback(async () => {}, []);
  const registerWithEmail = useCallback(async () => ({ status: 'verified', email: '', message: '' }), []);
  const verifyAccountCode = useCallback(async () => {}, []);
  const resendAccountCode = useCallback(async () => ({ status: 'ok', message: '' }), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        offlineProfile,
        saveOfflineProfile,
        token,
        isAuthenticated: true, // Always true for offline desktop app!
        isLoading,
        isAuthModalOpen,
        openAuthModal: () => setIsAuthModalOpen(true),
        closeAuthModal: () => setIsAuthModalOpen(false),
        isKeyModalOpen,
        openKeyModal: () => setIsKeyModalOpen(true),
        closeKeyModal: () => setIsKeyModalOpen(false),
        isHistoryDrawerOpen,
        openHistoryDrawer: () => setIsHistoryDrawerOpen(true),
        closeHistoryDrawer: () => setIsHistoryDrawerOpen(false),
        activeProvider,
        setActiveProvider: handleSetActiveProvider,
        activeModel,
        setActiveModel: handleSetActiveModel,
        runtimeKeys,
        setRuntimeKey,
        loginWithEmail,
        registerWithEmail,
        verifyAccountCode,
        resendAccountCode,
        logout,
        saveBYOKKeys,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

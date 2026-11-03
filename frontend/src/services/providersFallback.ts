import { ProviderItem, SecurityAssurance, ProvidersInfoResponse } from '../types';

export const FALLBACK_PROVIDERS_INFO: ProvidersInfoResponse = {
  providers: [
    {
      id: 'groq',
      name: 'Groq Cloud',
      tier: 'Free Tier',
      default_model: 'llama-3.1-8b-instant',
      models: [
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant (Ultra-Fast & Free)', cost: '100% Free' },
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', cost: 'Free Rate Limits' }
      ],
      signup_url: 'https://console.groq.com/keys',
      instructions: '1. Go to console.groq.com/keys\n2. Sign in with Google/GitHub\n3. Click "Create API Key"\n4. Copy key starting with "gsk_"',
      quota_estimate: 'Generous free tier: ~14,400 requests/day. Up to ~300 literature review runs daily for $0.',
      is_free: true
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      tier: 'Free Tier',
      default_model: 'gemini-2.0-flash',
      models: [
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Fastest & Recommended)', cost: '100% Free' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Large Context)', cost: '100% Free' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Deep Reasoning)', cost: 'Free Rate Limits' }
      ],
      signup_url: 'https://aistudio.google.com/app/apikey',
      instructions: '1. Open Google AI Studio (aistudio.google.com/app/apikey)\n2. Click "Get API key"\n3. Create key in new project\n4. Copy key starting with "AIzaSy"',
      quota_estimate: '1,500 free requests per day. Up to ~150 comprehensive literature syntheses daily for $0.',
      is_free: true
    },
    {
      id: 'claude',
      name: 'Anthropic Claude',
      tier: 'Frontier AI BYOK',
      default_model: 'claude-3-5-sonnet-20241022',
      models: [
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (State-of-the-Art)', cost: 'Pay-as-you-go' },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (High Speed)', cost: 'Pay-as-you-go' }
      ],
      signup_url: 'https://console.anthropic.com/settings/keys',
      instructions: '1. Navigate to console.anthropic.com/settings/keys\n2. Create or copy your API key starting with "sk-ant-"',
      quota_estimate: 'Direct Anthropic inference with zero middleware markup.',
      is_free: false
    },
    {
      id: 'openai',
      name: 'OpenAI',
      tier: 'GPT-4o BYOK',
      default_model: 'gpt-4o-mini',
      models: [
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Cost-Effective)', cost: 'Pay-as-you-go' },
        { id: 'gpt-4o', name: 'GPT-4o (Multimodal Reasoning)', cost: 'Pay-as-you-go' }
      ],
      signup_url: 'https://platform.openai.com/api-keys',
      instructions: '1. Go to platform.openai.com/api-keys\n2. Generate key starting with "sk-proj-" or "sk-"',
      quota_estimate: 'Direct OpenAI inference with structured JSON extraction.',
      is_free: false
    },
    {
      id: 'openrouter',
      name: 'OpenRouter',
      tier: 'Free & Universal',
      default_model: 'meta-llama/llama-3.3-70b-instruct:free',
      models: [
        { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free Tier)', cost: '100% Free' },
        { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash Exp (Free)', cost: '100% Free' }
      ],
      signup_url: 'https://openrouter.ai/keys',
      instructions: '1. Visit openrouter.ai/keys\n2. Click "Create Key"\n3. Copy key starting with "sk-or-"',
      quota_estimate: 'Free models tagged with ":free" incur $0 cost.',
      is_free: true
    },
    {
      id: 'deepseek',
      name: 'DeepSeek API',
      tier: 'Ultra-Low Cost',
      default_model: 'deepseek-chat',
      models: [
        { id: 'deepseek-chat', name: 'DeepSeek V3', cost: '$0.14 / 1M tokens' }
      ],
      signup_url: 'https://platform.deepseek.com/api_keys',
      instructions: '1. Go to platform.deepseek.com/api_keys\n2. Create key starting with "sk-"',
      quota_estimate: 'Extremely cost-effective: $1 covers ~3,000 papers.',
      is_free: false
    },
    {
      id: 'nvidia',
      name: 'NVIDIA NIM',
      tier: 'Free Credits',
      default_model: 'meta/llama-3.1-8b-instruct',
      models: [
        { id: 'meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B Instruct', cost: '1,000 Free Credits' }
      ],
      signup_url: 'https://build.nvidia.com/explore/discover',
      instructions: '1. Sign in to build.nvidia.com\n2. Get API key starting with "nvapi-"',
      quota_estimate: 'Includes 1,000 evaluation credits upon developer signup.',
      is_free: true
    },
    {
      id: 'custom',
      name: 'Custom OpenAI Endpoint',
      tier: 'Self-Hosted / Proxy',
      default_model: 'default',
      models: [
        { id: 'custom-model', name: 'Custom Specified Model', cost: 'Custom' }
      ],
      signup_url: 'https://github.com',
      instructions: 'Enter your Custom Base URL and API key.',
      quota_estimate: 'Controlled by your custom provider.',
      is_free: false
    }
  ],
  security_assurance: {
    title: 'Zero-Knowledge API Privacy & Isolation Assurance',
    points: [
      'Client-Isolated: Your keys never leave your device without explicit request dispatch.',
      'Local Storage: Keys are encrypted and stored in local device storage on Android tablets.',
      'Direct Upstream Dispatch: Literature synthesis calls are routed directly to verified provider endpoints.',
      'Zero Telemetry: No research data, personal papers, or prompts are collected.'
    ]
  }
};

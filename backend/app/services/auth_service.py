import os
import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import jwt
from cryptography.fernet import Fernet
from app.config import get_settings

# Master key derivation for AES-256 Fernet encryption
def get_fernet_cipher() -> Fernet:
    settings = get_settings()
    # Derive a 32-byte key from app master secret using SHA-256
    raw_secret = (getattr(settings, "secret_key", None) or "autolit-ai-master-byok-secret-2026-v3").encode("utf-8")
    derived_32 = hashlib.sha256(raw_secret).digest()
    fernet_key = base64.urlsafe_b64encode(derived_32)
    return Fernet(fernet_key)

CIPHER = get_fernet_cipher()

def encrypt_key(plain_key: Optional[str]) -> Optional[str]:
    """Encrypt user API key at rest using AES-256 Fernet."""
    if not plain_key or not plain_key.strip():
        return None
    token = CIPHER.encrypt(plain_key.strip().encode("utf-8"))
    return token.decode("utf-8")

def decrypt_key(encrypted_key: Optional[str]) -> Optional[str]:
    """Decrypt stored AES-256 encrypted API key in-memory during execution."""
    if not encrypted_key or not encrypted_key.strip():
        return None
    try:
        decrypted = CIPHER.decrypt(encrypted_key.strip().encode("utf-8"))
        return decrypted.decode("utf-8")
    except Exception as e:
        print(f"[Crypto Decrypt Warning]: Failed to decrypt key: {e}")
        return None

def mask_key(plain_key: Optional[str]) -> str:
    """Mask key for UI presentation (e.g., gsk_...1234)."""
    if not plain_key:
        return ""
    clean = plain_key.strip()
    if len(clean) <= 8:
        return "••••••••"
    return f"{clean[:4]}••••••••{clean[-4:]}"

def hash_password(password: str) -> str:
    """Secure password hashing with PBKDF2-HMAC-SHA256 and unique salt."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        iterations=100000
    )
    return f"{salt}:{key.hex()}"

def verify_password(password: str, hashed_value: str) -> bool:
    """Verify password against stored salt:hash."""
    try:
        parts = hashed_value.split(":")
        if len(parts) != 2:
            return False
        salt, expected_hex = parts[0], parts[1]
        test_key = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            iterations=100000
        )
        return secrets.compare_digest(test_key.hex(), expected_hex)
    except Exception:
        return False

JWT_SECRET = "autolit-jwt-secret-session-v3-token"
JWT_ALGORITHM = "HS256"

def create_access_token(user_id: str, email: str, expires_delta: Optional[timedelta] = None) -> str:
    """Generate signed JWT token for client sessions."""
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(days=14))
    payload: Dict[str, Any] = {
        "sub": user_id,
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp())
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate JWT access token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except Exception:
        return None

# Provider metadata, direct links, free-tier vs paid quota guidance
PROVIDERS_METADATA = [
    {
        "id": "groq",
        "name": "Groq Cloud",
        "tier": "Free Tier",
        "default_model": "openai/gpt-oss-20b",
        "models": [
            {"id": "openai/gpt-oss-20b", "name": "GPT OSS 20B (Recommended - 1,000 t/s)", "cost": "100% Free"},
            {"id": "llama-3.1-8b-instant", "name": "Llama 3.1 8B Instant", "cost": "100% Free"},
            {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B Versatile", "cost": "Free Rate Limits"}
        ],
        "signup_url": "https://console.groq.com/keys",
        "instructions": "1. Go to console.groq.com/keys\n2. Sign in with Google/GitHub\n3. Click 'Create API Key'\n4. Copy key starting with 'gsk_'",
        "quota_estimate": "Generous free tier: ~14,400 requests/day. Up to ~300 literature review runs per day completely free.",
        "is_free": True
    },
    {
        "id": "gemini",
        "name": "Google Gemini",
        "tier": "Free Tier",
        "default_model": "gemini-2.0-flash",
        "models": [
            {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash (Fastest & Recommended)", "cost": "100% Free"},
            {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash (Large Context)", "cost": "100% Free"},
            {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro (Deep Reasoning)", "cost": "Free Rate Limits"}
        ],
        "signup_url": "https://aistudio.google.com/app/apikey",
        "instructions": "1. Open Google AI Studio\n2. Click 'Get API key'\n3. Create key in new project\n4. Copy key starting with 'AIzaSy' or 'AQ.'",
        "quota_estimate": "1,500 free requests per day. Up to ~150 comprehensive literature syntheses daily for $0.",
        "is_free": True
    },
    {
        "id": "claude",
        "name": "Anthropic Claude",
        "tier": "Frontier AI BYOK",
        "default_model": "claude-3-5-sonnet-20241022",
        "models": [
            {"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet (State-of-the-Art)", "cost": "Pay-as-you-go"},
            {"id": "claude-3-5-haiku-20241022", "name": "Claude 3.5 Haiku (High Speed)", "cost": "Pay-as-you-go"}
        ],
        "signup_url": "https://console.anthropic.com/settings/keys",
        "instructions": "1. Open console.anthropic.com/settings/keys\n2. Click 'Create Key'\n3. Copy key starting with 'sk-ant-'",
        "quota_estimate": "Direct Anthropic inference with zero middleware markup.",
        "is_free": False
    },
    {
        "id": "openai",
        "name": "OpenAI",
        "tier": "Frontier AI BYOK",
        "default_model": "gpt-4o-mini",
        "models": [
            {"id": "gpt-4o-mini", "name": "GPT-4o Mini (Fast & Cost-Efficient)", "cost": "Pay-as-you-go"},
            {"id": "gpt-4o", "name": "GPT-4o (Omni Reasoning)", "cost": "Pay-as-you-go"}
        ],
        "signup_url": "https://platform.openai.com/api-keys",
        "instructions": "1. Open platform.openai.com/api-keys\n2. Click 'Create new secret key'\n3. Copy key starting with 'sk-proj-' or 'sk-'",
        "quota_estimate": "Direct OpenAI inference. GPT-4o-mini costs fractions of a cent per literature synthesis.",
        "is_free": False
    },
    {
        "id": "openrouter",
        "name": "OpenRouter",
        "tier": "Free & Universal",
        "default_model": "meta-llama/llama-3.3-70b-instruct:free",
        "models": [
            {"id": "meta-llama/llama-3.3-70b-instruct:free", "name": "Llama 3.3 70B (Free Tier)", "cost": "100% Free"},
            {"id": "google/gemini-2.0-flash-exp:free", "name": "Gemini 2.0 Flash Exp (Free)", "cost": "100% Free"},
            {"id": "deepseek/deepseek-chat", "name": "DeepSeek V3 (Pay-as-you-go)", "cost": "~$0.0003 / review"},
            {"id": "anthropic/claude-3.5-sonnet", "name": "Claude 3.5 Sonnet", "cost": "~$0.015 / review"}
        ],
        "signup_url": "https://openrouter.ai/keys",
        "instructions": "1. Visit openrouter.ai/keys\n2. Connect your wallet or account\n3. Click 'Create Key'\n4. Select ':free' models for zero cost or load credits for frontier models",
        "quota_estimate": "Unlimited daily calls on ':free' tagged models. Paid frontier models cost less than $0.001 per full triage.",
        "is_free": True
    },
    {
        "id": "deepseek",
        "name": "DeepSeek API",
        "tier": "Ultra-Low Cost",
        "default_model": "deepseek-chat",
        "models": [
            {"id": "deepseek-chat", "name": "DeepSeek V3 (High Reasoning)", "cost": "$0.14 / 1M tokens"},
            {"id": "deepseek-reasoner", "name": "DeepSeek R1 (Chain of Thought)", "cost": "$0.55 / 1M tokens"}
        ],
        "signup_url": "https://platform.deepseek.com/api_keys",
        "instructions": "1. Go to platform.deepseek.com/api_keys\n2. Register and top up $1-2 (lasts thousands of papers)\n3. Click 'Create API Key'\n4. Copy key starting with 'sk-'",
        "quota_estimate": "1 Dollar covers ~3,000 paper reviews! DeepSeek V3 is among the most economical reasoning models available.",
        "is_free": False
    },
    {
        "id": "nvidia",
        "name": "NVIDIA NIM",
        "tier": "Free Credits",
        "default_model": "meta/llama-3.1-8b-instruct",
        "models": [
            {"id": "meta/llama-3.1-8b-instruct", "name": "NVIDIA Llama 3.1 8B Instruct", "cost": "1,000 Free Credits"},
            {"id": "meta/llama-3.3-70b-instruct", "name": "NVIDIA Llama 3.3 70B Instruct", "cost": "Free Credits"}
        ],
        "signup_url": "https://build.nvidia.com/explore/discover",
        "instructions": "1. Navigate to build.nvidia.com\n2. Sign in with NVIDIA developer account (includes 1,000 free credits)\n3. Select Llama 3.1 and click 'Get API Key'\n4. Copy key starting with 'nvapi-'",
        "quota_estimate": "Includes 1,000 free NIM evaluation credits upon developer signup.",
        "is_free": True
    },
    {
        "id": "custom",
        "name": "Custom OpenAI Endpoint",
        "tier": "Self-Hosted / Proxy",
        "default_model": "default",
        "models": [
            {"id": "custom-model", "name": "Custom Specified Model", "cost": "Local / Custom"}
        ],
        "signup_url": "https://github.com",
        "instructions": "Point to any OpenAI-compatible proxy, vLLM, or enterprise gateway by providing your Custom Base URL and API Key.",
        "quota_estimate": "Controlled by your custom provider.",
        "is_free": False
    }
]

SECURITY_ASSURANCE = {
    "title": "Zero-Knowledge API Privacy & Isolation Assurance",
    "points": [
        "Client Isolation: Your keys are isolated to your account. No other user can ever access or query your keys.",
        "AES-256 Encryption at Rest: All API tokens are encrypted with military-grade AES-256 before writing to the database.",
        "No Data Selling / Telemetry: AutoLit AI never stores your research data for commercial training, marketing, or advertising.",
        "Direct Upstream Dispatch: Literature synthesis calls are routed directly from the backend to the verified provider endpoints.",
        "Full Data Ownership: Delete or update your credentials and research history at any time with a single click."
    ]
}

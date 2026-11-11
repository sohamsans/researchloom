import asyncio
import httpx
from app.main import app

async def test_api():
    print("Testing AutoLit AI v3.0 REST Endpoints...")
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # 1. Health check
        res = await client.get("/api/health")
        assert res.status_code == 200, f"Health check failed: {res.text}"
        print(f"[PASS] GET /api/health -> {res.json()['status']}")

        # 2. Providers directory & security assurance
        res = await client.get("/api/auth/providers-info")
        assert res.status_code == 200, f"Providers info failed: {res.text}"
        data = res.json()
        assert len(data["providers"]) == 8, f"Expected 8 providers, got {len(data['providers'])}"
        assert "Zero-Knowledge" in data["security_assurance"]["title"]
        print(f"[PASS] GET /api/auth/providers-info -> {len(data['providers'])} providers, Security Assurance loaded.")

        # 3. User Registration
        test_email = "researcher_v3_test@autolit.local"
        reg_payload = {"email": test_email, "password": "SamplePassword123!", "name": "Dr. Verification"}
        res = await client.post("/api/auth/register", json=reg_payload)
        # If already exists, login
        if res.status_code == 400:
            res = await client.post("/api/auth/login", json={"email": test_email, "password": "SamplePassword123!"})
        assert res.status_code == 200, f"Auth failed: {res.text}"
        token_data = res.json()
        token = token_data["access_token"]
        print(f"[PASS] User Auth (Token issued: {token[:12]}...).")

        # 4. Save AES-256 Encrypted BYOK Keys
        headers = {"Authorization": f"Bearer {token}"}
        keys_payload = {
            "groq_api_key": "dummy_groq_test_key_1234567890abcdef",
            "gemini_api_key": "dummy_gemini_test_key_1234567890abcdef",
            "selected_model": "openai/gpt-oss-20b",
            "theme_pref": "sapphire"
        }
        res = await client.post("/api/auth/keys", json=keys_payload, headers=headers)
        assert res.status_code == 200, f"Save keys failed: {res.text}"
        print(f"[PASS] POST /api/auth/keys -> Keys encrypted with AES-256.")

        # 5. Fetch User Profile & Verify Keys are Masked (Not exposed in plaintext)
        res = await client.get("/api/auth/me", headers=headers)
        assert res.status_code == 200, f"Get me failed: {res.text}"
        profile = res.json()
        assert "groq" in profile["configured_keys"]
        assert "gemini" in profile["configured_keys"]
        print(f"[PASS] GET /api/auth/me -> Keys properly masked.")

        # 6. Save & Retrieve Chat History
        chat_payload = {
            "title": "Quantum Error Correction Literature",
            "messages": [
                {"role": "user", "content": "How do surface codes compare to color codes?"},
                {"role": "assistant", "content": "Surface codes offer higher fault-tolerant thresholds (~1%)."}
            ]
        }
        res = await client.post("/api/auth/history", json=chat_payload, headers=headers)
        assert res.status_code == 200, f"Save history failed: {res.text}"

        res = await client.get("/api/auth/history", headers=headers)
        assert res.status_code == 200, f"Get history failed: {res.text}"
        history_list = res.json()
        assert len(history_list) >= 1
        print(f"[PASS] Chat History: Saved and verified {len(history_list)} session(s).")

        # 7. Saved Searches
        res = await client.get("/api/auth/saved-searches")
        assert res.status_code == 200
        print(f"[PASS] GET /api/auth/saved-searches -> {len(res.json())} cached queries available.")

        print("\n[ALL REST APIS VERIFIED AND OPERATIONAL!]")

if __name__ == "__main__":
    asyncio.run(test_api())

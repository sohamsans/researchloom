import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_sync_pin_generation_and_pairing():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. Generate PIN
        res_pin = await ac.get("/api/sync/pin")
        assert res_pin.status_code == 200
        pin_data = res_pin.json()
        assert "pin" in pin_data
        pin = pin_data["pin"]
        assert len(pin) == 6

        # 2. Pair Device with valid PIN
        res_pair = await ac.post("/api/sync/pair", json={"pin": pin, "device_name": "Xiaomi Pad 7"})
        assert res_pair.status_code == 200
        pair_data = res_pair.json()
        assert pair_data["status"] == "paired"
        assert "token" in pair_data
        token = pair_data["token"]

        # 3. Pull delta using token
        res_delta = await ac.get(f"/api/sync/delta?token={token}")
        assert res_delta.status_code == 200
        delta_data = res_delta.json()
        assert "papers" in delta_data
        assert "timestamp" in delta_data

        # 4. Push updates
        push_payload = {
            "token": token,
            "papers": [],
            "notes": [{"id": "n1", "content": "Tablet stylus test"}],
            "stylus_drawings": []
        }
        res_push = await ac.post("/api/sync/push", json=push_payload)
        assert res_push.status_code == 200
        push_data = res_push.json()
        assert push_data["status"] == "success"
        assert push_data["applied_count"] == 1

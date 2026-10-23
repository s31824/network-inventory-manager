"""Tests for the price list API."""

CW = {"model": "CW9162I", "vendor": "Meraki", "device_type": "Access point",
      "hardware_price": "650", "installation_cost": "120", "licence_per_year": "60"}
MR33 = {"model": "MR33", "vendor": "Meraki", "device_type": "Access point",
        "licence_per_year": "60", "replacement_model": "CW9162I"}


def test_create_and_list(client):
    assert client.post("/api/model-costs", json=CW).status_code == 201
    r = client.post("/api/model-costs", json=MR33)
    assert r.status_code == 201
    assert r.json()["ownership_per_year"] == "60.00"
    models = [m["model"] for m in client.get("/api/model-costs").json()]
    assert models == ["CW9162I", "MR33"]


def test_duplicate_model_is_rejected(client):
    client.post("/api/model-costs", json=CW)
    assert client.post("/api/model-costs", json=CW).status_code == 409


def test_replacement_must_exist(client):
    r = client.post("/api/model-costs", json=MR33)
    assert r.status_code == 422
    assert "not in the price list" in r.json()["detail"]


def test_invalid_values_are_rejected(client):
    assert client.post("/api/model-costs", json={**CW, "hardware_price": "-5"}).status_code == 422
    assert client.post("/api/model-costs", json={**CW, "model": "<script>"}).status_code == 422
    assert client.post("/api/model-costs", json={**CW, "currency": "XYZ"}).status_code == 422


def test_update_and_delete(client):
    client.post("/api/model-costs", json=CW)
    client.post("/api/model-costs", json=MR33)
    r = client.put("/api/model-costs/MR33", json={**MR33, "support_per_year": "10"})
    assert r.status_code == 200 and r.json()["ownership_per_year"] == "70.00"
    # CW9162I is used as a replacement, so it cannot be deleted yet
    assert client.delete("/api/model-costs/CW9162I").status_code == 409
    assert client.delete("/api/model-costs/MR33").status_code == 204
    assert client.delete("/api/model-costs/CW9162I").status_code == 204
    assert client.get("/api/model-costs").json() == []

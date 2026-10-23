"""Tests for the monthly import API."""

def payload(month="2026-10", **extra):
    return {
        "report_month": month,
        "file_name": f"Inventory_{month}.xlsx",
        "rows_read": 6,
        "locations": [
            {"code": "SE0029", "city": "Vasteras", "country": "Sweden", "category": "Bronze"},
            {"code": "DK0001", "city": "Esbjerg", "country": "Denmark", "category": "Platinum"},
        ],
        "device_counts": [
            {"location_code": "SE0029", "model": "MR33", "device_type": "WAP", "eos_date": "2026-07-21", "count": 3},
            {"location_code": "SE0029", "model": "MR36", "device_type": "WAP", "eos_date": None, "count": 2},
            {"location_code": "DK0001", "model": "WS-C3650-24PS-S", "device_type": "Switch",
             "eos_date": "2026-10-31", "count": 1},
        ],
        **extra,
    }


def test_import_and_list(client):
    r = client.post("/api/imports", json=payload())
    assert r.status_code == 201
    assert r.json()["device_count"] == 6
    assert [i["report_month"] for i in client.get("/api/imports").json()] == ["2026-10"]


def test_same_month_needs_replace(client):
    client.post("/api/imports", json=payload())
    assert client.post("/api/imports", json=payload()).status_code == 409
    assert client.post("/api/imports", json=payload(replace=True)).status_code == 201
    assert len(client.get("/api/imports").json()) == 1


def test_sensitive_fields_are_rejected(client):
    p = payload()
    p["device_counts"][0]["hostname"] = "SE190029-ap01"
    assert client.post("/api/imports", json=p).status_code == 422
    p = payload()
    p["locations"][0]["address"] = "Storgatan 37"
    assert client.post("/api/imports", json=p).status_code == 422


def test_unknown_location_and_duplicates_are_rejected(client):
    p = payload()
    p["device_counts"].append({"location_code": "XX9999", "model": "MR33", "device_type": "WAP", "count": 1})
    assert client.post("/api/imports", json=p).status_code == 422
    p = payload()
    p["device_counts"].append(dict(p["device_counts"][0]))
    assert client.post("/api/imports", json=p).status_code == 422


def test_delete_import(client):
    client.post("/api/imports", json=payload())
    assert client.delete("/api/imports/2026-10").status_code == 204
    assert client.get("/api/imports").json() == []

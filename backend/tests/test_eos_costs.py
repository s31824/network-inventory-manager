"""Tests for End of Support planning and the cost calculation."""
from decimal import Decimal

from tests.test_imports import payload

PRICES = [
    {"model": "CW9162I", "hardware_price": 650, "installation_cost": 120, "licence_per_year": 60},
    {"model": "MR33", "licence_per_year": 60, "replacement_model": "CW9162I"},
    {"model": "MR36", "licence_per_year": 60},
    {"model": "C9200L-24P-4G-E", "hardware_price": 2400, "installation_cost": 350, "support_per_year": 180},
    {"model": "WS-C3650-24PS-S", "support_per_year": 180, "replacement_model": "C9200L-24P-4G-E"},
]


def setup(client):
    for p in PRICES:
        assert client.post("/api/model-costs", json=p).status_code == 201
    assert client.post("/api/imports", json=payload()).status_code == 201


def d(x):
    return Decimal(str(x))


def test_eos_overview_lists_2026_locations(client):
    setup(client)
    r = client.get("/api/eos", params={"year": 2026}).json()
    assert r["devices"] == 4                       # 3 x MR33 + 1 x WS-C3650 (MR36 has no EOS)
    se = next(l for l in r["locations"] if l["code"] == "SE0029")
    assert se["status"] == "Not planned"
    assert se["models"][0]["replacement_model"] == "CW9162I"
    assert d(se["models"][0]["replacement_cost"]) == 3 * 770


def test_all_years_full_cost(client):
    setup(client)
    r = client.get("/api/costs", params={"year": "all"}).json()
    assert d(r["replacement"]["total"]) == 3 * 770 + 2750
    assert d(r["ownership"]["total"]) == 5 * 60 + 180   # 3 MR33 + 2 MR36 licences, 1 switch support


def test_plan_logic_for_a_year(client):
    setup(client)
    client.put("/api/eos/2026/locations/SE0029", json={"status": "Next", "planned_month": "2026-12"})
    client.put("/api/eos/2026/locations/SE0029/models/MR33", json={"decommission_count": 1})
    plan = client.get("/api/costs", params={"year": "2026"}).json()["plan"]
    assert d(plan["tiles"]["full"]) == 3 * 770 + 2750
    assert d(plan["tiles"]["planned"]) == 2 * 770           # 3 MR33 minus 1 decommissioned
    assert d(plan["tiles"]["avoided"]) == 770
    assert d(plan["tiles"]["not_planned"]) == 2750          # Denmark switch has no plan
    assert plan["by_group"][0]["label"] == "Denmark"


def test_country_filter_groups_by_city(client):
    setup(client)
    r = client.get("/api/costs", params={"year": "2026", "country": "Sweden"}).json()
    assert r["group_by"] == "city"
    assert [g["label"] for g in r["plan"]["by_group"]] == ["Vasteras"]


def test_invalid_plan_values(client):
    setup(client)
    assert client.put("/api/eos/2026/locations/SE0029", json={"status": "Whatever"}).status_code == 422
    assert client.put("/api/eos/2026/locations/XX0000", json={"status": "Next"}).status_code == 404
    assert client.put("/api/eos/2026/locations/SE0029/models/MR33",
                      json={"replacement_model": "NOPE"}).status_code == 422

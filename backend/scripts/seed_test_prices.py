"""Fill the price list with FICTIONAL test prices (for demos with test-data only).

Usage (from the backend folder, server running):  python scripts/seed_test_prices.py
"""
import json
import urllib.request

API = "http://127.0.0.1:8000/api/model-costs"

# New models first (they are referenced as replacements). Prices are made up.
NEW = [
    ("CW9162I", "Meraki", "Access point", 650, 120, 60, None),
    ("MR36", "Meraki", "Access point", 600, 120, 60, None),
    ("MR44", "Meraki", "Access point", 700, 120, 60, None),
    ("C9200L-24P-4G-E", "Cisco", "Switch", 2400, 350, None, 180),
    ("C9200L-48P-4G-E", "Cisco", "Switch", 3900, 350, None, 180),
    ("C9200L-24T-4G-E", "Cisco", "Switch", 1700, 300, None, 150),
    ("C9200L-48T-4G-E", "Cisco", "Switch", 2800, 300, None, 150),
    ("C9200CX-8P-2X2G", "Cisco", "Switch", 1100, 200, None, 120),
    ("C9200CX-12P-2X2G", "Cisco", "Switch", 1500, 200, None, 120),
    ("MS130-24P", "Meraki", "Switch", 1250, 200, 150, None),
    ("MS130-48P", "Meraki", "Switch", 1950, 300, 200, None),
    ("MS130-8P-I", "Meraki", "Switch", 900, 150, 150, None),
    ("C8300-1N1S-4T2X", "Cisco", "Router", 5200, 400, 400, 300),
    ("C8200L-1N-4T", "Cisco", "Router", 2200, 300, 200, 180),
    ("C8500L-8S4X", "Cisco", "Router", 14000, 1500, None, 1100),
    ("N9K-C93180YC-FX3", "Cisco", "Data center", 16000, 1500, None, 1500),
    ("N9K-C9364D-GX2A", "Cisco", "Data center", 38000, 2500, None, 3200),
    ("N9K-C9332D-GX2B", "Cisco", "Data center", 30500, 2000, None, 2800),
]
# Models in the inventory: own yearly costs + suggested replacement.
OLD = [
    ("MR33", "Meraki", "Access point", 60, None, "CW9162I"),
    ("MR42", "Meraki", "Access point", 60, None, "CW9162I"),
    ("MR18", "Meraki", "Access point", 60, None, "MR36"),
    ("MR16", "Meraki", "Access point", 60, None, "MR36"),
    ("MR20", "Meraki", "Access point", 60, None, "CW9162I"),
    ("MR28", "Meraki", "Access point", 60, None, None),
    ("WS-C3650-24PS-S", "Cisco", "Switch", None, 180, "C9200L-24P-4G-E"),
    ("WS-C3650-48PS-S", "Cisco", "Switch", None, 180, "C9200L-48P-4G-E"),
    ("WS-C3650-48TS-L", "Cisco", "Switch", None, 160, "C9200L-48T-4G-E"),
    ("WS-C2960+48TC-S", "Cisco", "Switch", None, 120, "C9200L-48T-4G-E"),
    ("WS-C2960+24LC-S", "Cisco", "Switch", None, 100, "C9200L-24T-4G-E"),
    ("C9200L-48P-4G", "Cisco", "Switch", None, 180, "C9200L-48P-4G-E"),
    ("WS-C3560CX-8PC-S", "Cisco", "Switch", None, 180, "C9200CX-8P-2X2G"),
    ("WS-C3560CX-12PC-S", "Cisco", "Switch", None, 180, "C9200CX-12P-2X2G"),
    ("MS120-24P", "Meraki", "Switch", 150, None, "MS130-24P"),
    ("MS120-48LP", "Meraki", "Switch", 200, None, "MS130-48P"),
    ("MS120-8FP", "Meraki", "Switch", 150, None, "MS130-8P-I"),
    ("C1111-4P", "Cisco", "Router", 80, 120, "C8200L-1N-4T"),
    ("C8200-1N-4T", "Cisco", "Router", 300, 250, "C8300-1N1S-4T2X"),
    ("ASR1001X-AES-AX", "Cisco", "Data center", None, 900, "C8500L-8S4X"),
    ("N9K-C93180YC-EX-B", "Cisco", "Data center", None, 1400, "N9K-C93180YC-FX3"),
    ("N9K-C9364C", "Cisco", "Data center", None, 3000, "N9K-C9364D-GX2A"),
]


def post(body: dict) -> int:
    req = urllib.request.Request(API, data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code


if __name__ == "__main__":
    added = skipped = 0
    for model, vendor, typ, hw, inst, lic, sup in NEW:
        status = post({"model": model, "vendor": vendor, "device_type": typ, "hardware_price": hw,
                       "installation_cost": inst, "licence_per_year": lic, "support_per_year": sup,
                       "price_date": "2026-10", "notes": "TEST DATA - fictional price"})
        added, skipped = (added + 1, skipped) if status == 201 else (added, skipped + 1)
    for model, vendor, typ, lic, sup, repl in OLD:
        status = post({"model": model, "vendor": vendor, "device_type": typ, "licence_per_year": lic,
                       "support_per_year": sup, "replacement_model": repl,
                       "price_date": "2026-10", "notes": "TEST DATA - fictional price"})
        added, skipped = (added + 1, skipped) if status == 201 else (added, skipped + 1)
    print(f"Added {added} models, skipped {skipped} (already in the price list).")

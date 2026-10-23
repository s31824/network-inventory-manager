"""Business rules shared by the EOS and Costs endpoints."""

LOCATION_STATUSES = ["Not planned", "Next", "To ship", "In progress", "On hold",
                     "Exception", "Decommission", "Out of scope", "Done"]
PLANNED_STATUSES = {"Next", "To ship", "In progress", "On hold", "Done"}   # counted as "already planned"
EXCLUDED_STATUSES = {"Out of scope", "Exception"}                         # not replaced, not a saving

CATEGORIES = ["Access point", "Switch", "Router", "Data center", "Other"]


def device_category(device_type: str) -> str:
    """Map the free-text DeviceType from the Excel file to one of 5 categories."""
    t = (device_type or "").strip().lower()
    if t == "wap" or "access point" in t:
        return "Access point"
    if t.startswith("dc"):
        return "Data center"
    if "switch" in t:
        return "Switch"
    if "router" in t or "sdwan" in t or "sd-wan" in t:
        return "Router"
    return "Other"

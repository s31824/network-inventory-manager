"""FastAPI application entry point.

Run locally (from the backend folder):  python -m uvicorn app.main:app --reload
"""
from fastapi import FastAPI

from app.routers import model_costs

app = FastAPI(title="Network Inventory Costs API", version="0.1.0")

app.include_router(model_costs.router)


@app.get("/api/health", tags=["Health"])
def health():
    return {"status": "ok"}

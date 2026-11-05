"""
MarineSure 2.0 – FastAPI Application Factory & Main Entrypoint
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import auth, shipments, users
from app.core.config import get_settings
from app.core.logging import get_logger, setup_logging
from app.database.connection import SessionLocal
from app.services.auth_service import seed_roles

settings = get_settings()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    setup_logging("DEBUG" if settings.DEBUG else "INFO")
    logger.info("Starting %s in %s mode", settings.APP_NAME, settings.APP_ENV)
    db = SessionLocal()
    try:
        seed_roles(db)
    except Exception:
        logger.warning("Role seed skipped; database is not reachable yet")
    finally:
        db.close()
    yield
    logger.info("Shutting down %s", settings.APP_NAME)


def create_application() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=f"{settings.APP_NAME} API",
        version="2.0.0",
        description=(
            "Marine Cargo Insurance Policy, Shipment Protection "
            "and Claims Management System"
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/api/v1/openapi.json",
        lifespan=lifespan,
    )

    # ── CORS Middleware ──────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Healthcheck & Base Routes ────────────────────────────────
    @app.get("/health", tags=["System"])
    async def health_check():
        return {
            "status": "healthy",
            "app": settings.APP_NAME,
            "version": "2.0.0",
            "environment": settings.APP_ENV,
        }

    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(users.router, prefix="/api/v1")
    app.include_router(shipments.router, prefix="/api/v1")

    @app.get("/api/v1", tags=["System"])
    async def api_info():
        return {
            "name": f"{settings.APP_NAME} API",
            "version": "2.0.0",
            "status": "active",
            "documentation": "/docs",
        }

    return app


app = create_application()

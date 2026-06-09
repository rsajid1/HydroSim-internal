from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth
from app.routers import database
from app.routers import users

# Logging import
from app.utils.logger import logger_setup
# Health router
from app.routers.health import health_router
from config import settings

#  FastAPI instance 
app = FastAPI(
    title="HydroSim API",
    description="Interactive Hydroponics & Greenhouse Simulator Backend API",
    version="0.1.0",
    debug=settings.debug,
)

# Initialize logger
log = logger_setup()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health_router)


@app.get("/")
async def root():
    """Root endpoint."""
    log.info("hydrosim_request", route="/", status="ok")
    return {
        "message": "HydroSim API",
        "version": "1.1.0",
        "status": "running"
    }


# Authentication
app.include_router(auth.router)

# Database
app.include_router(database.router)

# Users
app.include_router(users.router)

# future api routes: Simulations , production, etc.. here.

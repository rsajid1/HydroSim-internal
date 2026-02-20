from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Application
    debug: bool = False

    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    # AWS Cognito
    cognito_region: str = ""
    cognito_user_pool_id: str = ""
    cognito_client_id: str = ""
    cognito_client_secret: str = ""

    # Database
    db_host: str = ""
    db_user: str = ""
    db_password: str = ""
    db_name: str = "postgres"
    db_port: int = 5432

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

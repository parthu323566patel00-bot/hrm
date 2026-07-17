from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_ignore_empty=True, extra="ignore"
    )

    PROJECT_NAME: str = "Medicore Hospital Management System"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080
    DATABASE_URL: str

    # ── YARA malware scanning ─────────────────────────────────────────────
    YARA_ENABLED: bool = True
    YARA_RULES_PATH: str = "app/security/yara_rules"

    # ── Gemini AI — document extraction ──────────────────────────────────
    # Primary OCR/extraction path. Falls back to PyMuPDF + regex if absent.
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "models/gemini-2.0-flash"


settings = Settings()

# Medicore-HMS Backend

Medicore Hospital Management System (HMS) backend built with FastAPI, SQLAlchemy, and SQLite.

## Project Structure
```
medicore-hms/
├── app/
│   ├── api/          # API routers and versioning
│   ├── core/         # Settings, database connection, and security
│   ├── crud/         # Database operations helpers
│   ├── models/       # SQLAlchemy models
│   ├── schemas/      # Pydantic validation schemas
│   └── tests/        # Pytest test suite
├── .env              # Environment configurations
├── requirements.txt  # Dependencies list
└── README.md         # Project documentation
```

## Setup & Running

1. **Activate Virtual Environment** (Created by user):
   - Windows:
     ```powershell
     .venv\Scripts\activate
     ```
   - Unix/macOS:
     ```bash
     source .venv/bin/activate
     ```

2. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Start the Development Server**:
   ```bash
   uvicorn app.main:app --reload --port 8001
   ```

4. **Access Swagger UI API Docs**:
   Navigate to [http://127.0.0.1:8001/docs](http://127.0.0.1:8001/docs) in your browser.


## Running Tests

To execute the test suite, run:
```bash
pytest
```

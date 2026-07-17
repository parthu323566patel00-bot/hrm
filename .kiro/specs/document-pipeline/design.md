# Document Management Pipeline — Design

## Architecture

### Service Layer
```
DocumentUploadService   — orchestrates the upload flow
StorageService          — StorageProvider interface, LocalStorage impl
VirusScannerService     — ClamAV impl, swappable interface
HashService             — SHA-256 streaming computation
OCRService              — PyMuPDF + PaddleOCR hybrid
ClassificationService   — keyword + heuristic document type detection
ParserService           — structured JSON extraction per document type
ProcessingService       — background worker orchestrating OCR → parse
DocumentStatusService   — status reads/writes
AuditService            — append-only audit log writes
```

### File Layout
```
app/
  documents/
    models.py           — Document, DocumentContent, DocumentAuditLog
    schemas.py          — Pydantic schemas
    services/
      storage.py        — StorageProvider ABC + LocalStorageProvider
      virus_scan.py     — VirusScannerService
      hash_service.py   — HashService
      ocr_service.py    — OCRService
      classifier.py     — ClassificationService
      parser.py         — ParserService
      processing.py     — ProcessingService (background worker)
      audit.py          — AuditService
    upload.py           — DocumentUploadService
    endpoints.py        — FastAPI router
  api/v1/api.py         — register documents router
```

## Database Tables

### documents
```sql
id                   SERIAL PK
tenant_id            VARCHAR(50) NOT NULL FK tenants.id
patient_id           INTEGER NOT NULL FK patients.id
visit_id             INTEGER NULL FK visits.id
uploaded_by          INTEGER NOT NULL FK users.id
document_type        VARCHAR(50) NOT NULL DEFAULT 'misc'
original_filename    VARCHAR(255) NOT NULL
stored_filename      VARCHAR(255) NOT NULL UNIQUE
storage_path         VARCHAR(500) NOT NULL
file_size            BIGINT NOT NULL
mime_type            VARCHAR(100) NOT NULL
sha256_hash          VARCHAR(64) NOT NULL
is_duplicate         BOOLEAN NOT NULL DEFAULT FALSE
original_document_id INTEGER NULL FK documents.id
status               VARCHAR(40) NOT NULL DEFAULT 'UPLOADING'
is_deleted           BOOLEAN NOT NULL DEFAULT FALSE
uploaded_at          TIMESTAMPTZ NOT NULL
```

### document_content
```sql
id                   SERIAL PK
document_id          INTEGER NOT NULL UNIQUE FK documents.id
raw_text             TEXT NULL
structured_json      JSONB NULL
ocr_engine           VARCHAR(50) NULL
ocr_status           VARCHAR(20) DEFAULT 'pending'
classified_as        VARCHAR(50) NULL
confidence           FLOAT NULL
parser_version       VARCHAR(20) NULL
parsed_at            TIMESTAMPTZ NULL
```

### document_audit_logs
```sql
id                   SERIAL PK
document_id          INTEGER NOT NULL FK documents.id
actor_id             INTEGER NOT NULL FK users.id
tenant_id            VARCHAR(50) NOT NULL
action               VARCHAR(30) NOT NULL
ip_address           VARCHAR(45) NULL
metadata_json        TEXT NULL
created_at           TIMESTAMPTZ NOT NULL
```

## API Endpoints
```
POST   /documents/upload              — upload file (multipart)
GET    /documents/{id}/status         — poll status
GET    /documents/{id}                — get metadata
GET    /documents/{id}/file           — stream original file
GET    /documents/{id}/content        — get OCR text + structured JSON
GET    /patients/{patient_id}/documents  — list docs (metadata only)
POST   /documents/{id}/retry-processing — retry failed OCR/parse
DELETE /documents/{id}                — soft delete
```

## Background Processing Flow
```
[HTTP returns 201] → [BackgroundTask enqueued]
    ↓
status = PROCESSING
    ↓
OCRService.extract(document)
    ↓ (PDF with text?)  YES → PyMuPDF, skip paddleocr
    ↓ (scanned/image?)  YES → PaddleOCR
    ↓ (handwritten?)    → raw text only, status = MANUAL_REVIEW_REQUIRED
    ↓
status = OCR_COMPLETED
    ↓
ClassificationService.classify(raw_text)
    ↓
status = PARSING
    ↓
ParserService.parse(document_type, raw_text)
    ↓
status = READY
```

## Storage Interface
```python
class StorageProvider(ABC):
    async def save(self, path: str, stream: AsyncGenerator) -> str: ...
    async def read(self, path: str) -> AsyncGenerator: ...
    async def delete(self, path: str) -> None: ...
    async def exists(self, path: str) -> bool: ...
```

from pydantic import BaseModel
from datetime import datetime

class InvitationCreate(BaseModel):
    email: str
    role_id: int

class InvitationOut(BaseModel):
    id: int
    email: str
    role_id: int
    tenant_id: str
    token: str
    expires_at: datetime
    is_used: bool

    class Config:
        from_attributes = True

class InvitationRegister(BaseModel):
    token: str
    password: str

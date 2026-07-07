from typing import Optional, List
from pydantic import BaseModel, ConfigDict

# Shared properties
class UserBase(BaseModel):
    email: str
    tenant_id: str
    role_id: Optional[int] = None
    is_active: Optional[bool] = True
    is_superuser: Optional[bool] = False
    full_name: Optional[str] = None


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str

# Properties to receive via API on update
class UserUpdate(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None

# Properties to return to client
class UserOut(UserBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

# Token structures
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[str] = None

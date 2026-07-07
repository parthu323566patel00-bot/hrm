"""
app/api/deps.py
---------------
Shared FastAPI dependencies used across all route modules.

Moving `get_current_user` here eliminates cross-endpoint imports and gives
every router a single, consistent place to import auth dependencies from.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import ALGORITHM
from app.crud.user import get_user
from app.models.user import User
from app.schemas.user import TokenData

# ---------------------------------------------------------------------------
# OAuth2 scheme — points at the login endpoint so OpenAPI docs work correctly
# ---------------------------------------------------------------------------
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> User:
    """
    Decode the JWT bearer token, look up the user in the database, and return
    the active User ORM object.  Raises HTTP 401 on any credential failure and
    HTTP 400 if the account is inactive.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # --- Decode JWT ---
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        token_data = TokenData(user_id=user_id)
    except JWTError:
        raise credentials_exception

    # --- Fetch from DB ---
    try:
        user = await get_user(db, user_id=int(token_data.user_id))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database query failed: {str(exc)}",
        )

    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user",
        )

    return user

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.user import User
from app.models.permission import Permission
from app.models.role_permission import RolePermission
from app.models.user_permission import UserPermission

async def has_permission(db: AsyncSession, user: User, perm_code: str) -> bool:
    """
    Check if a user has a specific permission code.
    Evaluates: Super Admin Bypass -> User Overrides (Deny has precedence) -> Role Permissions.
    """
    if user.is_superuser:
        return True

    # Fetch the permission object
    perm_result = await db.execute(select(Permission).filter(Permission.code == perm_code))
    permission = perm_result.scalars().first()
    if not permission:
        return False

    # Check explicit User Permission Overrides
    override_result = await db.execute(
        select(UserPermission).filter(
            UserPermission.user_id == user.id,
            UserPermission.permission_id == permission.id
        )
    )
    override = override_result.scalars().first()
    if override:
        if override.effect == "deny":
            return False
        elif override.effect == "allow":
            return True

    # Check Role Permissions
    if not user.role_id:
        return False

    rp_result = await db.execute(
        select(RolePermission).filter(
            RolePermission.role_id == user.role_id,
            RolePermission.permission_id == permission.id
        )
    )
    rp = rp_result.scalars().first()
    return rp is not None

"""
Database Recovery Script
Drops all tables and recreates them with fresh seeding.
Run this when the database is in an inconsistent state.
"""
import asyncio
import sys
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base

# Import all models and config
from app.core.config import settings
from app.core.database import Base, SessionLocal
import app.models  # noqa: F401

# Import seeding utilities
from app.models.tenant import Tenant
from app.models.permission import Permission
from app.models.role import Role
from app.models.role_permission import RolePermission
from app.crud.user import create_user
from app.schemas.user import UserCreate


PREDEFINED_PERMISSIONS = [
    # Authentication
    ("auth:login", "Allow user to log in", "auth"),
    ("auth:logout", "Allow user to log out", "auth"),
    ("auth:change_password", "Allow password changes", "auth"),
    ("auth:reset_password", "Allow password reset", "auth"),
    # User Management
    ("user:create", "Create users", "user"),
    ("user:view", "View users list and profiles", "user"),
    ("user:update", "Update user accounts", "user"),
    ("user:delete", "Delete user accounts", "user"),
    ("user:assign_role", "Assign role to users", "user"),
    # Role & Permission
    ("role:create", "Create roles", "role"),
    ("role:view", "View roles list", "role"),
    ("role:update", "Update roles", "role"),
    ("role:delete", "Delete roles", "role"),
    ("permission:view", "View permissions list", "role"),
    ("permission:assign", "Assign permissions to roles", "role"),
    ("user_permission:assign", "Assign user override permissions", "role"),
    # Tenant / Branch
    ("tenant:create", "Create tenants", "tenant"),
    ("tenant:view", "View tenants", "tenant"),
    ("tenant:update", "Update tenant info", "tenant"),
    ("tenant:delete", "Delete tenants", "tenant"),
    ("branch:create", "Create branches", "tenant"),
    ("branch:view", "View branches", "tenant"),
    ("branch:update", "Update branches", "tenant"),
    ("branch:delete", "Delete branches", "tenant"),
    # Department Management
    ("department:create", "Create departments", "department"),
    ("department:view", "View departments", "department"),
    ("department:update", "Update departments", "department"),
    ("department:delete", "Delete departments", "department"),
    # Doctor Management
    ("doctor:create", "Create doctor profiles", "doctor"),
    ("doctor:view", "View doctor profiles", "doctor"),
    ("doctor:update", "Update doctor profiles", "doctor"),
    ("doctor:delete", "Delete doctor profiles", "doctor"),
    # Patient Management
    ("patient:create", "Create patient records", "patient"),
    ("patient:view", "View patient records", "patient"),
    ("patient:update", "Update patient records", "patient"),
    ("patient:delete", "Delete patient records", "patient"),
    # Appointment Management
    ("appointment:create", "Create appointments", "appointment"),
    ("appointment:view", "View appointments", "appointment"),
    ("appointment:update", "Update appointments", "appointment"),
    ("appointment:cancel", "Cancel appointments", "appointment"),
    # Visit Management
    ("visit:create", "Create patient visits", "visit"),
    ("visit:view", "View patient visits", "visit"),
    ("visit:update", "Update patient visits", "visit"),
    ("visit:close", "Close patient visits", "visit"),
    # Clinical Notes
    ("clinical_note:view", "View clinical notes", "visit"),
    ("clinical_note:create", "Create clinical notes", "visit"),
    ("clinical_note:update", "Update clinical notes", "visit"),
    # Vitals
    ("vitals:view", "View patient vitals", "visit"),
    ("vitals:record", "Record patient vitals", "visit"),
    ("vitals:update", "Update patient vitals", "visit"),
    # Prescriptions
    ("prescription:create", "Create prescriptions", "visit"),
    ("prescription:view", "View prescriptions", "visit"),
    ("prescription:update", "Update prescriptions", "visit"),
    # Lab Orders
    ("lab_order:create", "Create lab orders", "visit"),
    ("lab_order:view", "View lab orders", "visit"),
    ("lab_order:update", "Update lab orders", "visit"),
    # Radiology Orders
    ("radiology_order:view", "View radiology orders", "radiology"),
    ("radiology_image:view", "View radiology images", "radiology"),
    ("radiology_report:enter", "Enter radiology reports", "radiology"),
    ("radiology_report:update", "Update radiology reports", "radiology"),
    ("radiology_report:approve", "Approve radiology reports", "radiology"),
    # Pharmacy
    ("prescription:view", "View prescriptions list", "pharmacy"),
    ("medicine:dispense", "Dispense medications", "pharmacy"),
    ("medicine:return", "Return dispensed medications", "pharmacy"),
    ("medicine:stock_check", "Check medicine stock levels", "pharmacy"),
    # Inventory
    ("inventory:category:create", "Create inventory categories", "inventory"),
    ("inventory:category:view", "View inventory categories", "inventory"),
    ("inventory:category:update", "Update inventory categories", "inventory"),
    ("inventory:unit:create", "Create inventory units", "inventory"),
    ("inventory:unit:view", "View inventory units", "inventory"),
    ("inventory:unit:update", "Update inventory units", "inventory"),
    ("inventory:manufacturer:create", "Create manufacturers", "inventory"),
    ("inventory:manufacturer:view", "View manufacturers", "inventory"),
    ("inventory:manufacturer:update", "Update manufacturers", "inventory"),
    ("inventory:brand:create", "Create brands", "inventory"),
    ("inventory:brand:view", "View brands", "inventory"),
    ("inventory:brand:update", "Update brands", "inventory"),
    ("inventory:supplier:create", "Create suppliers", "inventory"),
    ("inventory:supplier:view", "View suppliers", "inventory"),
    ("inventory:supplier:update", "Update suppliers", "inventory"),
    ("inventory:location:create", "Create storage locations", "inventory"),
    ("inventory:location:view", "View storage locations", "inventory"),
    ("inventory:location:update", "Update storage locations", "inventory"),
    ("inventory:product:create", "Create products", "inventory"),
    ("inventory:product:view", "View products", "inventory"),
    ("inventory:product:update", "Update products", "inventory"),
    ("inventory:product:search", "Search products", "inventory"),
    ("inventory:purchase_order:create", "Create purchase orders", "inventory"),
    ("inventory:purchase_order:view", "View purchase orders", "inventory"),
    ("inventory:purchase_order:update", "Update purchase orders", "inventory"),
    ("inventory:purchase_order:cancel", "Cancel purchase orders", "inventory"),
    ("inventory:goods_receipt:create", "Create goods receipts", "inventory"),
    ("inventory:goods_receipt:view", "View goods receipts", "inventory"),
    ("inventory:stock:view", "View inventory stock levels", "inventory"),
    ("inventory:stock:change", "Create stock transactions", "inventory"),
    ("inventory:ledger:view", "View inventory ledger entries", "inventory"),
    # Billing
    ("invoice:create", "Create billing invoices", "billing"),
    ("invoice:view", "View billing invoices", "billing"),
    ("invoice:update", "Update billing invoices", "billing"),
    ("invoice:cancel", "Cancel billing invoices", "billing"),
    ("payment:record", "Record invoice payments", "billing"),
    ("payment:refund", "Issue payment refunds", "billing"),
    ("insurance:claim", "File insurance claims", "billing"),
    ("receipt:print", "Print billing receipts", "billing"),
    # Reports
    ("report:view", "View hospital reports", "reports"),
    ("report:export", "Export hospital reports", "reports"),
    ("dashboard:view", "View system dashboard widgets", "reports"),
    ("analytics:view", "View advanced hospital analytics", "reports"),
    # Audit
    ("audit_log:view", "View system audit logs", "audit"),
    ("audit_log:export", "Export system audit logs", "audit"),
    # Notification
    ("notification:view", "View notifications list", "notification"),
    ("notification:send", "Send direct notifications", "notification"),
    ("notification:broadcast", "Broadcast general announcements", "notification"),
    # Admin
    ("settings:view", "View hospital system settings", "admin"),
    ("settings:update", "Update hospital system settings", "admin"),
    ("backup:create", "Create database backups", "admin"),
    ("backup:restore", "Restore database backups", "admin"),
    ("system:maintenance", "Trigger system maintenance modes", "admin"),
]


async def drop_all_tables():
    """Drop all existing tables."""
    print("⏳ Dropping all existing tables...")
    engine = create_async_engine(settings.DATABASE_URL, future=True)
    
    try:
        async with engine.begin() as conn:
            # Get all table names
            await conn.run_sync(Base.metadata.drop_all)
        print("✅ All tables dropped successfully")
    except Exception as e:
        print(f"❌ Error dropping tables: {e}")
        raise
    finally:
        await engine.dispose()


async def create_all_tables():
    """Recreate all tables from models."""
    print("⏳ Creating all tables...")
    engine = create_async_engine(settings.DATABASE_URL, future=True)
    
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✅ All tables created successfully")
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        raise
    finally:
        await engine.dispose()


async def seed_default_data():
    """Seed default permissions, roles, and users."""
    print("⏳ Seeding default data...")
    
    async with SessionLocal() as db:
        try:
            # 1. Create default tenant
            print("  - Creating default tenant...")
            tenant = Tenant(id="default-hospital", name="MediCore Default Hospital")
            db.add(tenant)
            await db.commit()
            await db.refresh(tenant)
            print(f"    ✅ Tenant created: {tenant.id}")
            
            # 2. Create permissions
            print("  - Creating permissions...")
            permissions_mapped = {}
            seen_codes = set()
            for code, desc, mod in PREDEFINED_PERMISSIONS:
                # Skip duplicates
                if code in seen_codes:
                    continue
                seen_codes.add(code)
                perm = Permission(code=code, description=desc, module=mod)
                db.add(perm)
                permissions_mapped[code] = perm
            await db.commit()
            print(f"    ✅ {len(permissions_mapped)} permissions created")
            
            # 3. Create default roles
            print("  - Creating default roles...")
            
            # Super Admin (all permissions)
            super_admin_role = Role(
                tenant_id="default-hospital",
                name="Super Admin",
                description="System Administrator with all permissions"
            )
            db.add(super_admin_role)
            await db.commit()
            await db.refresh(super_admin_role)
            
            # Assign all permissions to super admin
            for perm in permissions_mapped.values():
                role_perm = RolePermission(
                    tenant_id="default-hospital",
                    role_id=super_admin_role.id,
                    permission_id=perm.id,
                    role_name=super_admin_role.name
                )
                db.add(role_perm)
            await db.commit()
            print(f"    ✅ Super Admin role created")
            
            # Doctor role (specific permissions)
            doctor_role = Role(
                tenant_id="default-hospital",
                name="Doctor",
                description="Healthcare provider"
            )
            db.add(doctor_role)
            await db.commit()
            await db.refresh(doctor_role)
            
            doctor_perms = [
                "auth:login", "patient:view", "visit:create", "visit:view", "visit:update",
                "clinical_note:view", "clinical_note:create", "clinical_note:update",
                "vitals:view", "vitals:record", "vitals:update",
                "prescription:create", "prescription:view", "prescription:update",
                "lab_order:create", "lab_order:view", "lab_order:update",
                "radiology_order:view", "radiology_report:enter",
                "report:view", "dashboard:view", "notification:view",
                "appointment:create", "appointment:view", "appointment:update"
            ]
            for perm_code in doctor_perms:
                if perm_code in permissions_mapped:
                    role_perm = RolePermission(
                        tenant_id="default-hospital",
                        role_id=doctor_role.id,
                        permission_id=permissions_mapped[perm_code].id,
                        role_name=doctor_role.name
                    )
                    db.add(role_perm)
            await db.commit()
            print(f"    ✅ Doctor role created")
            
            # Nurse role
            nurse_role = Role(
                tenant_id="default-hospital",
                name="Nurse",
                description="Nursing staff"
            )
            db.add(nurse_role)
            await db.commit()
            await db.refresh(nurse_role)
            
            nurse_perms = [
                "auth:login", "patient:view", "patient:update",
                "visit:view", "visit:update", "vitals:record", "vitals:view",
                "clinical_note:view", "report:view", "dashboard:view", "notification:view"
            ]
            for perm_code in nurse_perms:
                if perm_code in permissions_mapped:
                    role_perm = RolePermission(
                        tenant_id="default-hospital",
                        role_id=nurse_role.id,
                        permission_id=permissions_mapped[perm_code].id,
                        role_name=nurse_role.name
                    )
                    db.add(role_perm)
            await db.commit()
            print(f"    ✅ Nurse role created")
            
            # Hospital Admin role (inventory, users, settings)
            admin_role = Role(
                tenant_id="default-hospital",
                name="Hospital Admin",
                description="Hospital administration"
            )
            db.add(admin_role)
            await db.commit()
            await db.refresh(admin_role)
            
            admin_perms = [
                "auth:login", "user:create", "user:view", "user:update", "user:delete", "user:assign_role",
                "role:view", "role:create", "role:update",
                "department:create", "department:view", "department:update", "department:delete",
                "appointment:create", "appointment:view", "appointment:update", "appointment:cancel",
                "patient:view", "patient:create", "patient:update",
                "inventory:category:create", "inventory:category:view", "inventory:category:update",
                "inventory:unit:create", "inventory:unit:view", "inventory:unit:update",
                "inventory:manufacturer:create", "inventory:manufacturer:view", "inventory:manufacturer:update",
                "inventory:brand:create", "inventory:brand:view", "inventory:brand:update",
                "inventory:supplier:create", "inventory:supplier:view", "inventory:supplier:update",
                "inventory:location:create", "inventory:location:view", "inventory:location:update",
                "inventory:product:create", "inventory:product:view", "inventory:product:update", "inventory:product:search",
                "inventory:purchase_order:create", "inventory:purchase_order:view", "inventory:purchase_order:update",
                "inventory:goods_receipt:create", "inventory:goods_receipt:view",
                "inventory:stock:view", "inventory:stock:change", "inventory:ledger:view",
                "settings:view", "settings:update", "audit_log:view",
                "report:view", "dashboard:view", "notification:view"
            ]
            for perm_code in admin_perms:
                if perm_code in permissions_mapped:
                    role_perm = RolePermission(
                        tenant_id="default-hospital",
                        role_id=admin_role.id,
                        permission_id=permissions_mapped[perm_code].id,
                        role_name=admin_role.name
                    )
                    db.add(role_perm)
            await db.commit()
            print(f"    ✅ Hospital Admin role created")
            
            # Inventory Manager role
            inventory_manager_role = Role(
                tenant_id="default-hospital",
                name="Inventory Manager",
                description="Inventory management personnel"
            )
            db.add(inventory_manager_role)
            await db.commit()
            await db.refresh(inventory_manager_role)
            
            inv_mgr_perms = [
                "auth:login",
                "inventory:category:create", "inventory:category:view", "inventory:category:update",
                "inventory:unit:create", "inventory:unit:view", "inventory:unit:update",
                "inventory:manufacturer:create", "inventory:manufacturer:view", "inventory:manufacturer:update",
                "inventory:brand:create", "inventory:brand:view", "inventory:brand:update",
                "inventory:supplier:create", "inventory:supplier:view", "inventory:supplier:update",
                "inventory:location:create", "inventory:location:view", "inventory:location:update",
                "inventory:product:create", "inventory:product:view", "inventory:product:update", "inventory:product:search",
                "inventory:purchase_order:create", "inventory:purchase_order:view", "inventory:purchase_order:update", "inventory:purchase_order:cancel",
                "inventory:goods_receipt:create", "inventory:goods_receipt:view",
                "inventory:stock:view", "inventory:stock:change", "inventory:ledger:view",
                "report:view", "dashboard:view", "notification:view"
            ]
            for perm_code in inv_mgr_perms:
                if perm_code in permissions_mapped:
                    role_perm = RolePermission(
                        tenant_id="default-hospital",
                        role_id=inventory_manager_role.id,
                        permission_id=permissions_mapped[perm_code].id,
                        role_name=inventory_manager_role.name
                    )
                    db.add(role_perm)
            await db.commit()
            print(f"    ✅ Inventory Manager role created")
            
            # 4. Create default users
            print("  - Creating default users...")
            
            # System admin
            admin_in = UserCreate(
                email="admin@medicore.com",
                tenant_id="default-hospital",
                role_id=super_admin_role.id,
                password="adminpassword123",
                full_name="System Admin",
                is_superuser=True,
                is_active=True,
            )
            await create_user(db, user_in=admin_in)
            print(f"    ✅ System admin created: admin@medicore.com")
            
            # Hospital admin
            hosp_admin_in = UserCreate(
                email="hospital_admin@medicore.com",
                tenant_id="default-hospital",
                role_id=admin_role.id,
                password="hospitaladmin123",
                full_name="Hospital Administrator",
                is_superuser=False,
                is_active=True,
            )
            await create_user(db, user_in=hosp_admin_in)
            print(f"    ✅ Hospital admin created: hospital_admin@medicore.com")
            
            print("✅ Database seeded with default data")
            
        except Exception as e:
            await db.rollback()
            print(f"❌ Error seeding data: {e}")
            raise


async def main():
    """Execute recovery process."""
    print("\n" + "="*60)
    print("DATABASE RECOVERY PROCESS")
    print("="*60 + "\n")
    
    try:
        await drop_all_tables()
        await create_all_tables()
        await seed_default_data()
        
        print("\n" + "="*60)
        print("✅ DATABASE RECOVERY COMPLETED SUCCESSFULLY")
        print("="*60)
        print("\n📋 Default Credentials:")
        print("  System Admin: admin@medicore.com / adminpassword123")
        print("  Hospital Admin: hospital_admin@medicore.com / hospitaladmin123")
        print("\n")
        
    except Exception as e:
        print("\n" + "="*60)
        print(f"❌ RECOVERY FAILED: {e}")
        print("="*60 + "\n")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy.future import select
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.api.v1.api import api_router
from app.crud.user import get_user_by_email, create_user
from app.schemas.user import UserCreate

# Import newly added models for seeding
from app.models.tenant import Tenant
from app.models.permission import Permission
from app.models.role import Role
from app.models.role_permission import RolePermission
from app.models.department import Department

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
    # Patient Module
    ("patient:create", "Create patients", "patient"),
    ("patient:view", "View patient details", "patient"),
    ("patient:update", "Update patient details", "patient"),
    ("patient:delete", "Delete patient records", "patient"),
    ("patient:search", "Search patient records", "patient"),
    ("patient:merge", "Merge duplicate patient files", "patient"),
    ("patient:archive", "Archive patient records", "patient"),
    # Appointment Module
    ("appointment:create", "Create clinic appointments", "appointment"),
    ("appointment:view", "View clinic appointments", "appointment"),
    ("appointment:update", "Update clinic appointments", "appointment"),
    ("appointment:cancel", "Cancel clinic appointments", "appointment"),
    ("appointment:reschedule", "Reschedule clinic appointments", "appointment"),
    ("appointment:checkin", "Check in patients for appointments", "appointment"),
    ("appointment:checkout", "Check out patients from appointments", "appointment"),
    ("appointment:queue", "Manage patient appointment queue", "appointment"),
    # Doctor Module
    ("consultation:start", "Start doctor consultations", "doctor"),
    ("consultation:view", "View doctor consultations", "doctor"),
    ("consultation:update", "Update doctor consultations", "doctor"),
    ("consultation:close", "Close doctor consultations", "doctor"),
    ("patient_chart:view", "View patient medical charts", "doctor"),
    ("diagnosis:create", "Create clinical diagnoses", "doctor"),
    ("prescription:create", "Create patient prescriptions", "doctor"),
    ("medical_record:create", "Create patient medical records", "doctor"),
    ("medical_record:update", "Update patient medical records", "doctor"),
    # Nurse Module
    ("vitals:record", "Record patient vitals", "nurse"),
    ("vitals:view", "View patient vitals", "nurse"),
    ("care_plan:view", "View patient care plans", "nurse"),
    ("care_plan:update", "Update patient care plans", "nurse"),
    ("procedure:perform", "Perform nursing procedures", "nurse"),
    ("bed:assign", "Assign patient beds", "nurse"),
    ("bed:release", "Release patient beds", "nurse"),
    ("discharge:prepare", "Prepare patient discharge plans", "nurse"),
    # Laboratory
    ("lab_order:create", "Create laboratory orders", "laboratory"),
    ("lab_order:view", "View laboratory orders", "laboratory"),
    ("lab_order:update", "Update laboratory orders", "laboratory"),
    ("sample:collect", "Collect laboratory samples", "laboratory"),
    ("sample:receive", "Receive laboratory samples", "laboratory"),
    ("lab_test:process", "Process laboratory tests", "laboratory"),
    ("lab_result:enter", "Enter laboratory results", "laboratory"),
    ("lab_result:update", "Update laboratory results", "laboratory"),
    ("lab_result:verify", "Verify laboratory results", "laboratory"),
    ("lab_result:publish", "Publish laboratory results", "laboratory"),
    # Radiology
    ("radiology_order:create", "Create radiology orders", "radiology"),
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
    # Billing
    ("invoice:create", "Create billing invoices", "billing"),
    ("invoice:view", "View billing invoices", "billing"),
    ("invoice:update", "Update billing invoices", "billing"),
    ("invoice:cancel", "Cancel billing invoices", "billing"),
    ("payment:record", "Record invoice payments", "billing"),
    ("payment:refund", "Issue payment refunds", "billing"),
    ("insurance:claim", "File insurance claims", "billing"),
    ("receipt:print", "Print billing receipts", "billing"),
    # Inventory
    ("inventory:view", "View inventory stock list", "inventory"),
    ("inventory:update", "Update inventory stock counts", "inventory"),
    ("purchase_order:create", "Create stock purchase orders", "inventory"),
    ("purchase_order:approve", "Approve stock purchase orders", "inventory"),
    ("purchase_order:view", "View stock purchase orders", "inventory"),
    ("goods:receive", "Receive ordered stock goods", "inventory"),
    ("supplier:view", "View inventory suppliers", "inventory"),
    ("supplier:create", "Create inventory suppliers", "inventory"),
    ("supplier:update", "Update inventory suppliers", "inventory"),
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

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create database tables asynchronously on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    # Seed default SaaS values
    async with SessionLocal() as db:
        # 1. Seed Tenant
        result = await db.execute(select(Tenant).filter(Tenant.id == "default-hospital"))
        tenant = result.scalars().first()
        if not tenant:
            tenant = Tenant(id="default-hospital", name="MediCore Default Hospital")
            db.add(tenant)
            await db.commit()
            await db.refresh(tenant)

        # 2. Seed Permissions
        permissions_mapped = {}
        for code, desc, mod in PREDEFINED_PERMISSIONS:
            res = await db.execute(select(Permission).filter(Permission.code == code))
            perm = res.scalars().first()
            if not perm:
                perm = Permission(code=code, description=desc, module=mod)
                db.add(perm)
                await db.commit()
                await db.refresh(perm)
            else:
                # Update module/desc if they changed
                perm.description = desc
                perm.module = mod
                db.add(perm)
            permissions_mapped[code] = perm
        await db.commit()

        # 3. Seed Roles with explicit IDs
        role_definitions = [
            (1, "Super Admin", "Full system access"),
            (2, "Hospital Admin", "Administration except server maintenance and restore"),
            (3, "Receptionist", "Front desk patient and appointment management"),
            (4, "Doctor", "Clinical diagnosis, consultation, and prescription controls"),
            (5, "Nurse", "Vitals monitoring and care management"),
            (6, "Lab Technician", "Laboratory test and results controls"),
            (7, "Radiologist", "Radiology reports and image review"),
            (8, "Pharmacist", "Prescription dispensing and medicine stocks"),
            (9, "Billing Clerk", "Invoicing and payment processing"),
            (10, "Inventory Manager", "Purchase orders and goods receipt"),
        ]
        
        roles_mapped = {}
        for r_id, r_name, r_desc in role_definitions:
            res = await db.execute(select(Role).filter(Role.id == r_id))
            role_obj = res.scalars().first()
            if not role_obj:
                role_obj = Role(
                    id=r_id,
                    tenant_id="default-hospital",
                    name=r_name,
                    description=r_desc
                )
                db.add(role_obj)
                await db.commit()
                await db.refresh(role_obj)
            roles_mapped[r_name] = role_obj

        # Role mappings
        role_permission_mappings = {
            "Super Admin": [p[0] for p in PREDEFINED_PERMISSIONS],
            
            "Hospital Admin": [p[0] for p in PREDEFINED_PERMISSIONS if p[0] not in [
                "backup:restore", "system:maintenance"
            ]],
            
            "Receptionist": [
                "patient:create", "patient:view", "patient:update", "patient:search",
                "appointment:create", "appointment:view", "appointment:update", "appointment:cancel", "appointment:reschedule", "appointment:checkin", "appointment:queue",
                "dashboard:view", "notification:view"
            ],
            
            "Doctor": [
                "patient:view", "patient:search",
                "patient_chart:view",
                "consultation:start", "consultation:view", "consultation:update", "consultation:close",
                "medical_record:create", "medical_record:update",
                "diagnosis:create",
                "prescription:create",
                "lab_order:create",
                "radiology_order:create",
                "appointment:view", "appointment:update",
                "dashboard:view"
            ],
            
            "Nurse": [
                "patient:view",
                "patient_chart:view",
                "vitals:record", "vitals:view",
                "care_plan:view", "care_plan:update",
                "procedure:perform",
                "bed:assign", "bed:release",
                "discharge:prepare",
                "dashboard:view"
            ],
            
            "Lab Technician": [
                "lab_order:view", "lab_order:update",
                "sample:collect", "sample:receive",
                "lab_test:process",
                "lab_result:enter", "lab_result:update", "lab_result:publish",
                "dashboard:view"
            ],
            
            "Radiologist": [
                "radiology_order:view",
                "radiology_image:view",
                "radiology_report:enter", "radiology_report:update", "radiology_report:approve",
                "dashboard:view"
            ],
            
            "Pharmacist": [
                "prescription:view",
                "medicine:dispense",
                "medicine:return",
                "medicine:stock_check",
                "dashboard:view"
            ],
            
            "Billing Clerk": [
                "invoice:create", "invoice:view", "invoice:update",
                "payment:record",
                "insurance:claim",
                "receipt:print",
                "dashboard:view"
            ],
            
            "Inventory Manager": [
                "inventory:view",
                "inventory:update",
                "purchase_order:create", "purchase_order:view", "purchase_order:approve",
                "goods:receive",
                "supplier:view", "supplier:create", "supplier:update",
                "dashboard:view"
            ]
        }

        # 4. Bind permissions to roles, storing role_name
        for r_name, p_codes in role_permission_mappings.items():
            role_obj = roles_mapped[r_name]
            for code in p_codes:
                perm_obj = permissions_mapped.get(code)
                if perm_obj:
                    res = await db.execute(
                        select(RolePermission).filter(
                            RolePermission.role_id == role_obj.id,
                            RolePermission.permission_id == perm_obj.id
                        )
                    )
                    rp = res.scalars().first()
                    if not rp:
                        rp = RolePermission(
                            tenant_id="default-hospital",
                            role_id=role_obj.id,
                            permission_id=perm_obj.id,
                            role_name=role_obj.name
                        )
                        db.add(rp)
        await db.commit()

        # 4.5 Seed Departments
        PREDEFINED_DEPARTMENTS = [
            ("Cardiology", "CARD", "Heart and Cardiovascular Care"),
            ("Neurology", "NEUR", "Brain and Nervous System"),
            ("Pediatrics", "PEDI", "Child and Infant Health"),
            ("Orthopedics", "ORTH", "Musculoskeletal Care"),
            ("Obstetrics & Gynecology (OB/GYN)", "OBGY", "Women's Health & Maternity"),
            ("General Medicine / Internal Medicine", "GENM", "Primary Care"),
            ("General Surgery", "GENS", "Surgical Procedures"),
            ("Dermatology", "DERM", "Skin Care"),
            ("Radiology", "RAD", "Imaging: X-Ray, MRI, Ultrasound"),
            ("Pathology / Laboratory", "PATH", "Diagnostic Testing"),
            ("Emergency Medicine", "ER", "ER / Urgent Care"),
            ("Pharmacy", "PHAR", "Dispensing & Stock Management"),
        ]
        
        departments_mapped = {}
        for name, code, desc in PREDEFINED_DEPARTMENTS:
            res = await db.execute(select(Department).filter(Department.tenant_id == "default-hospital", Department.code == code))
            dept = res.scalars().first()
            if not dept:
                dept = Department(
                    tenant_id="default-hospital",
                    name=name,
                    code=code,
                    description=desc,
                    is_active=True
                )
                db.add(dept)
                await db.commit()
                await db.refresh(dept)
            else:
                dept.name = name
                dept.description = desc
                db.add(dept)
            departments_mapped[code] = dept
        await db.commit()

        # 5. Seed default admin user linked to Tenant and Super Admin Role (ID=1)
        admin_email = "admin@medicore.com"
        admin_user = await get_user_by_email(db, email=admin_email)
        if not admin_user:
            admin_in = UserCreate(
                email=admin_email,
                tenant_id="default-hospital",
                role_id=1,  # Super Admin ID
                password="adminpassword123",  # Will be hashed in create_user
                full_name="System Administrator",
                is_superuser=True,
                is_active=True
            )
            await create_user(db, user_in=admin_in)
            print("System seeded with default admin user: admin@medicore.com / adminpassword123")

        # 6. Seed default Hospital Admin user linked to Tenant and Hospital Admin Role (ID=2)
        hadmin_email = "hospital_admin@medicore.com"
        hadmin_user = await get_user_by_email(db, email=hadmin_email)
        if not hadmin_user:
            hadmin_in = UserCreate(
                email=hadmin_email,
                tenant_id="default-hospital",
                role_id=2,  # Hospital Admin ID
                password="hospitaladmin123",  # Will be hashed in create_user
                full_name="Dr. Alexander Sterling",
                is_superuser=False,
                is_active=True
            )
            await create_user(db, user_in=hadmin_in)
            print("System seeded with default hospital admin user: hospital_admin@medicore.com / hospitaladmin123")
    yield




app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# Set CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for development. Change for production.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():

    return {
        "message": f"Welcome to the {settings.PROJECT_NAME} API",
        "docs": "/docs",
        "status": "healthy"
    }

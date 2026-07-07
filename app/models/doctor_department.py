from sqlalchemy import Column, Integer, ForeignKey
from app.core.database import Base


class DoctorDepartment(Base):
    __tablename__ = "doctor_departments"

    doctor_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="CASCADE"), primary_key=True)

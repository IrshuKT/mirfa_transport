"""Sequence counter table — used by utils/numbering.py"""
from sqlalchemy import BigInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class NumberSequence(Base):
    __tablename__ = "number_sequences"

    seq_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    last_value: Mapped[int] = mapped_column(BigInteger, default=1, nullable=False)

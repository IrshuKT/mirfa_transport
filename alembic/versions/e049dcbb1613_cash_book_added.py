"""cash book added

Revision ID: e049dcbb1613
Revises: 5332f0f97c46
Create Date: 2026-07-17 11:39:24.122606

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'e049dcbb1613'
down_revision: Union[str, None] = '5332f0f97c46'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.add_column("accounts", sa.Column("is_cash", sa.Boolean(), nullable=False, server_default="false"))

def downgrade():
    op.drop_column("accounts", "is_cash")
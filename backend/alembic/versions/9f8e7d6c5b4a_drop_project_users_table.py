"""drop project_users table

Revision ID: 9f8e7d6c5b4a
Revises: f2a3b4c5d6e7
Create Date: 2026-07-01 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9f8e7d6c5b4a"
down_revision: Union[str, Sequence[str], None] = "f2a3b4c5d6e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "project_users" in inspector.get_table_names():
        op.drop_table("project_users")


def downgrade() -> None:
    op.create_table(
        "project_users",
        sa.Column("project_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.PrimaryKeyConstraint("project_id", "user_id"),
    )

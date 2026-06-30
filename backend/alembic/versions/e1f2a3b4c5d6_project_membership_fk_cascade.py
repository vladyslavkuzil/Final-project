"""project_membership fk cascade

Revision ID: e1f2a3b4c5d6
Revises: d8e9f0a1b2c3
Create Date: 2026-06-29 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, Sequence[str], None] = "d8e9f0a1b2c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint(
        "project_membership_project_id_fkey", "project_membership", type_="foreignkey"
    )
    op.drop_constraint(
        "project_membership_user_id_fkey", "project_membership", type_="foreignkey"
    )
    op.create_foreign_key(
        "project_membership_project_id_fkey",
        "project_membership",
        "projects",
        ["project_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "project_membership_user_id_fkey",
        "project_membership",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(
        "project_membership_project_id_fkey", "project_membership", type_="foreignkey"
    )
    op.drop_constraint(
        "project_membership_user_id_fkey", "project_membership", type_="foreignkey"
    )
    op.create_foreign_key(
        "project_membership_project_id_fkey",
        "project_membership",
        "projects",
        ["project_id"],
        ["id"],
    )
    op.create_foreign_key(
        "project_membership_user_id_fkey",
        "project_membership",
        "users",
        ["user_id"],
        ["id"],
    )

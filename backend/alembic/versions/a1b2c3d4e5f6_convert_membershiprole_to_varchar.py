"""convert membershiprole column from native enum to varchar

Revision ID: a1b2c3d4e5f6
Revises: f2a3b4c5d6e7
Create Date: 2026-06-30 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "f2a3b4c5d6e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Convert role columns from PostgreSQL native enum type to VARCHAR.

    psycopg3 does not automatically cast text parameters to custom enum
    types, causing DataError on insert.  VARCHAR storage is equivalent for
    our use-case and avoids the type-mismatch at the driver level.

    Both project_membership.role and join_code.role depend on this type.
    """
    op.alter_column(
        "project_membership",
        "role",
        type_=sa.String(),
        existing_type=sa.Enum("owner", "participant", name="membershiprole"),
        existing_nullable=False,
        postgresql_using="role::VARCHAR",
    )
    op.alter_column(
        "join_code",
        "role",
        type_=sa.String(),
        existing_type=sa.Enum("owner", "participant", name="membershiprole"),
        existing_nullable=False,
        postgresql_using="role::VARCHAR",
    )
    op.execute("DROP TYPE IF EXISTS membershiprole")


def downgrade() -> None:
    """Revert role columns back to the native membershiprole enum type."""
    membershiprole = sa.Enum("owner", "participant", name="membershiprole")
    membershiprole.create(op.get_bind())
    op.alter_column(
        "project_membership",
        "role",
        type_=membershiprole,
        existing_type=sa.String(),
        existing_nullable=False,
        postgresql_using="role::membershiprole",
    )
    op.alter_column(
        "join_code",
        "role",
        type_=membershiprole,
        existing_type=sa.String(),
        existing_nullable=False,
        postgresql_using="role::membershiprole",
    )

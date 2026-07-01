"""placeholder for historical alembic revision

Revision ID: 73feed320b1f
Revises: e1f2a3b4c5d6
Create Date: 2026-06-30 00:00:00.000000

"""

from typing import Sequence, Union


revision: str = "73feed320b1f"
down_revision: Union[str, Sequence[str], None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """No-op placeholder for an older revision that existed in deployments."""
    pass


def downgrade() -> None:
    """No-op downgrade for the placeholder revision."""
    pass

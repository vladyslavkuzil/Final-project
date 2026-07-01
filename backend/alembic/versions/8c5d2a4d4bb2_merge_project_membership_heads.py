"""merge project membership migration heads

Revision ID: 8c5d2a4d4bb2
Revises: 73feed320b1f, d31e780e7725
Create Date: 2026-07-01 12:30:00.000000

"""

from typing import Sequence, Union


revision: str = "8c5d2a4d4bb2"
down_revision: Union[str, Sequence[str], None] = ("73feed320b1f", "d31e780e7725")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Merge the historical placeholder branch with the current migration branch."""
    pass


def downgrade() -> None:
    """Downgrade is a no-op for the merge revision."""
    pass

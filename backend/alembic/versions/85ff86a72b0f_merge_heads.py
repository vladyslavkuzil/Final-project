"""merge heads

Revision ID: 85ff86a72b0f
Revises: 8c5d2a4d4bb2, e15ee09c44fb
Create Date: 2026-07-01 19:58:26.882894

"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = '85ff86a72b0f'
down_revision: Union[str, Sequence[str], None] = ('8c5d2a4d4bb2', 'e15ee09c44fb')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

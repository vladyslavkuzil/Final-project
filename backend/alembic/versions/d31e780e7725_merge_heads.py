"""merge heads

Revision ID: d31e780e7725
Revises: 9f8e7d6c5b4a, a1b2c3d4e5f6
Create Date: 2026-07-01 12:14:19.457208

"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = 'd31e780e7725'
down_revision: Union[str, Sequence[str], None] = ('9f8e7d6c5b4a', 'a1b2c3d4e5f6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

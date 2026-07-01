"""merge_chat_and_join_codes_heads

Revision ID: e15ee09c44fb
Revises: 02f1e1663b1d, 1dc572aa79f8
Create Date: 2026-07-01 16:05:56.289311

"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = 'e15ee09c44fb'
down_revision: Union[str, Sequence[str], None] = ('02f1e1663b1d', '1dc572aa79f8')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass

"""allow null uploaded_by on documents, set null on user deletion

Revision ID: 662d65361970
Revises: 2a30004e7e71
Create Date: 2026-07-02 22:17:51.236234

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '662d65361970'
down_revision: Union[str, Sequence[str], None] = '2a30004e7e71'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('documents', 'uploaded_by',
               existing_type=sa.VARCHAR(),
               nullable=True)
    op.drop_constraint(op.f('documents_uploaded_by_fkey'), 'documents', type_='foreignkey')
    op.create_foreign_key(
        'documents_uploaded_by_fkey', 'documents', 'users', ['uploaded_by'], ['id'], ondelete='SET NULL'
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('documents_uploaded_by_fkey', 'documents', type_='foreignkey')
    op.create_foreign_key(
        op.f('documents_uploaded_by_fkey'), 'documents', 'users', ['uploaded_by'], ['id']
    )
    op.alter_column('documents', 'uploaded_by',
               existing_type=sa.VARCHAR(),
               nullable=False)

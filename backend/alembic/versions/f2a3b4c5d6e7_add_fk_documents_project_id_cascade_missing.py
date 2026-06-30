"""add fk documents project id cascade missing

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-06-29 00:00:00.000000

"""

from typing import Sequence, Union


revision: str = "f2a3b4c5d6e7"
down_revision: Union[str, Sequence[str], None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # fk_documents_project_id was already created in a71286368b57; no-op here.
    pass


def downgrade() -> None:
    # Nothing was created in upgrade, so nothing to drop.
    pass

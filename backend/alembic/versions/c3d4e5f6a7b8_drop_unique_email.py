"""drop the unique constraint on users.email

Revision ID: c3d4e5f6a7b8
Revises: b1a2c3d4e5f6
Create Date: 2026-10-12 00:00:00.000000

``email`` is a mirror of a Supabase-owned value: Supabase guarantees uniqueness
per project, but a user can be removed out of band (for example from the
dashboard), which leaves an orphan row whose email would block a later signup.
The identity key is ``supabase_user_id`` (still unique), so ``email`` only keeps
a plain index for lookups.
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: str | Sequence[str] | None = "b1a2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Replace the unique index on users.email with a plain one."""
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=False)


def downgrade() -> None:
    """Restore the unique index (fails if duplicate emails exist)."""
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

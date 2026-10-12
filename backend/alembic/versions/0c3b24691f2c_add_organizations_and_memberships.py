"""add organizations and memberships

Revision ID: 0c3b24691f2c
Revises: c3d4e5f6a7b8
Create Date: 2026-10-12 16:13:17.485110

An organization is the tenant that every future domain row will belong to, and a
membership grants a user a role inside one. Authorization resolves permissions
through memberships (see ``app/organizations``), so this is the first pair of
tables that makes tenancy enforceable.

Both foreign keys cascade on delete: a hard-deleted profile must not leave
membership rows behind pointing at a user that no longer exists.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0c3b24691f2c"
down_revision: str | Sequence[str] | None = "c3d4e5f6a7b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create the organizations and memberships tables."""
    op.create_table(
        "organizations",
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_organizations")),
    )
    # Unique index: the slug identifies an organization in URLs, so it must be
    # unique, and the index makes lookups by slug cheap.
    op.create_index(op.f("ix_organizations_slug"), "organizations", ["slug"], unique=True)

    op.create_table(
        "memberships",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        # The role is checked in the database too: a manual query must not be
        # able to introduce a role the authorization layer does not know about.
        sa.CheckConstraint("role IN ('owner', 'member')", name=op.f("ck_memberships_role_valid")),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_memberships_organization_id_organizations"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_memberships_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_memberships")),
        # A user either belongs to an organization or does not. This composite
        # index also serves "list my organizations" queries, because user_id is
        # its leading column.
        sa.UniqueConstraint("user_id", "organization_id", name="uq_memberships_user_organization"),
    )
    # Indexed separately because the composite unique index above cannot serve
    # "every member of this organization" queries.
    op.create_index(
        op.f("ix_memberships_organization_id"), "memberships", ["organization_id"], unique=False
    )


def downgrade() -> None:
    """Drop the memberships and organizations tables."""
    op.drop_index(op.f("ix_memberships_organization_id"), table_name="memberships")
    op.drop_table("memberships")
    op.drop_index(op.f("ix_organizations_slug"), table_name="organizations")
    op.drop_table("organizations")

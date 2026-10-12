import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_db_session
from app.organizations.models import Membership
from app.organizations.service import find_membership
from app.users.dependencies import get_current_user
from app.users.models import User


async def get_current_membership(
    organization_id: uuid.UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_async_db_session)],
) -> Membership:
    """Resolve the organization in the path for the current user.

    A caller who is not a member gets a 404, never a 403: the response must not
    tell an organization that exists apart from one that does not. The next
    phase moves this rule behind ``app/authz``.
    """
    membership = await find_membership(session, user_id=user.id, organization_id=organization_id)

    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    return membership

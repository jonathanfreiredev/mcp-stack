import asyncio
import uuid
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.verifier import InvalidTokenError, decode_access_token

# auto_error=False so we control the response: a missing header is a 401, not a
# framework-generated error.
_bearer_scheme = HTTPBearer(auto_error=False)

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated",
    headers={"WWW-Authenticate": "Bearer"},
)


@dataclass(frozen=True)
class TokenClaims:
    """The subset of Supabase access-token claims the API relies on."""

    subject: uuid.UUID
    email: str | None
    metadata: dict


async def get_token_claims(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)],
) -> TokenClaims:
    """Resolve a verified Supabase access token into its claims."""
    if credentials is None:
        raise _UNAUTHORIZED

    try:
        # Verifying is blocking (the JWKS lookup hits the network on a cache
        # miss), so it runs in a worker thread instead of stalling the loop.
        claims = await asyncio.to_thread(decode_access_token, credentials.credentials)
    except InvalidTokenError:
        raise _UNAUTHORIZED from None

    subject = claims.get("sub")
    if not isinstance(subject, str):
        raise _UNAUTHORIZED

    try:
        subject_id = uuid.UUID(subject)
    except ValueError:
        raise _UNAUTHORIZED from None

    return TokenClaims(
        subject=subject_id,
        email=claims.get("email"),
        metadata=claims.get("user_metadata") or {},
    )

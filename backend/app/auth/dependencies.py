import asyncio
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.claims import InvalidClaims, TokenClaims, parse_claims
from app.auth.verifier import InvalidTokenError, decode_access_token

# auto_error=False so we control the response: a missing header is a 401, not a
# framework-generated error.
_bearer_scheme = HTTPBearer(auto_error=False)

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_token_claims(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)],
) -> TokenClaims:
    """Resolve a verified Supabase access token into its claims."""
    if credentials is None:
        raise _UNAUTHORIZED

    try:
        # Verifying is blocking (the JWKS lookup hits the network on a cache
        # miss), so it runs in a worker thread instead of stalling the loop.
        payload = await asyncio.to_thread(decode_access_token, credentials.credentials)
        return parse_claims(payload)
    except InvalidTokenError, InvalidClaims:
        raise _UNAUTHORIZED from None

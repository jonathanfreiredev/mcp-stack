"""The tools the MCP server exposes.

A tool is a thin adapter: resolve the caller from the token, call the domain, and
return a typed result. No business rule lives here — the rules are in the domain
services, shared with the API, so the two doors cannot drift apart.

Nor does authorization live here. The service a tool calls is the one that checks
what the caller's role grants, exactly as it does for the API, so there is no
second place where a permission could be written down and then forgotten.
"""

import uuid

from fastmcp import Context
from fastmcp.server.dependencies import get_access_token
from mcp.types import ElicitRequest, ElicitRequestFormParams, InputRequiredResult
from pydantic import BaseModel

from app.auth.claims import parse_claims
from app.db.session import async_session_maker
from app.mcp.server import mcp
from app.users.service import get_or_create_user

QUESTION = "Type any word"
ANSWER_FIELD = "value"


class CallerProfile(BaseModel):
    """The authenticated caller's own profile."""

    id: uuid.UUID
    email: str | None
    full_name: str | None


class UserAnswer(BaseModel):
    """What the user answered.

    ``outcome`` is the protocol's own vocabulary — ``accept``, ``decline`` or
    ``cancel`` — because a refusal is an answer, not an error.
    """

    outcome: str
    answer: str | None = None


@mcp.tool
async def whoami() -> CallerProfile:
    """Return the profile of the user whose token is calling this tool.

    The caller comes from the access token, never from an argument: arguments are
    chosen by a model, and a model can be talked into lying.
    """
    access = get_access_token()
    if access is None:  # pragma: no cover - the endpoint rejects unauthenticated calls
        raise RuntimeError("whoami was called without an access token")

    claims = parse_claims(access.claims)

    async with async_session_maker() as session:
        user = await get_or_create_user(session, claims)

    return CallerProfile(id=user.id, email=user.email, full_name=user.full_name)


@mcp.tool
async def ask_the_user(ctx: Context) -> UserAnswer | InputRequiredResult:
    """Ask the user for a word. The pattern for anything that needs a person.

    Asking goes one way here, and it is **not** the way FastMCP's main guide shows,
    so this is worth reading before writing a tool that needs an answer.

    This server runs ``stateless_http`` (see ``app/mcp/main.py``), so no session
    exists to hold a back-channel open: ``ctx.elicit()`` has nothing to send it on
    and fails with ``NoBackChannelError``. The protocol removed that back-channel
    in its 2026-07-28 era for exactly this reason and replaced it with a
    round-trip — so a tool asks by *returning* the request. The call ends, the
    client puts the question to the user however it likes, calls again with the
    answer, and the tool re-runs from the top to look for it in
    ``ctx.input_responses``.

    That makes a tool which asks into a **guard**: each round it decides whether it
    already has what it needs or has to ask. It holds nothing itself between
    rounds — everything it needs travels on the request, and ``ctx.request_state``
    is there for a small sealed value when re-deriving one would be worse.

    A client that negotiated an older era cannot be asked at all: returning this
    request on such a connection raises an error naming the era, which is the
    honest answer rather than a silent fallback.
    """
    if ctx.input_responses is None:
        return _ask_for_text(QUESTION)

    response = ctx.input_responses[ANSWER_FIELD]
    if response.action != "accept":
        return UserAnswer(outcome=response.action)

    return UserAnswer(outcome="accept", answer=response.content[ANSWER_FIELD])


def _ask_for_text(question: str) -> InputRequiredResult:
    """Build the request that asks the client for a single line of text.

    Written by hand because there is no method to call: on this era asking *is*
    returning. The schema is the one FastMCP would generate for
    ``ctx.elicit(..., response_type=str)``, so the client renders the same form it
    would have on the other era.
    """
    return InputRequiredResult(
        result_type="input_required",
        input_requests={
            ANSWER_FIELD: ElicitRequest(
                method="elicitation/create",
                params=ElicitRequestFormParams(
                    message=question,
                    requested_schema={
                        "type": "object",
                        "properties": {ANSWER_FIELD: {"type": "string"}},
                        "required": [ANSWER_FIELD],
                    },
                ),
            )
        },
    )

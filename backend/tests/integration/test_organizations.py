import uuid

import pytest
from sqlalchemy import func, select

from app.organizations.models import Membership
from app.users.models import User
from tests.auth_stub import mint_token
from tests.helpers import auth_header

pytestmark = pytest.mark.anyio


async def _create_organization(client, token: str, name: str = "Acme") -> dict:
    """Create an organization through the API and return the response body."""
    response = await client.post(
        "/v1/organizations", json={"name": name}, headers=auth_header(token)
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_organizations_require_authentication(client):
    assert (await client.get("/v1/organizations")).status_code == 401
    assert (await client.post("/v1/organizations", json={"name": "Acme"})).status_code == 401


async def test_creating_an_organization_makes_the_creator_its_owner(client):
    token = mint_token()

    organization = await _create_organization(client, token)

    assert organization["name"] == "Acme"
    assert organization["slug"] == "acme"
    assert organization["role"] == "owner"


async def test_the_owner_is_the_only_member_at_first(client):
    token = mint_token()
    organization = await _create_organization(client, token)

    response = await client.get(
        f"/v1/organizations/{organization['id']}/members", headers=auth_header(token)
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["role"] == "owner"
    # The member's profile comes along, so a client can render a member list
    # without a second request per row.
    assert body["items"][0]["user"]["email"] == "jane@example.com"


async def test_reading_an_organization_returns_the_callers_role(client):
    token = mint_token()
    organization = await _create_organization(client, token)

    response = await client.get(
        f"/v1/organizations/{organization['id']}", headers=auth_header(token)
    )

    assert response.status_code == 200
    assert response.json()["role"] == "owner"


async def test_an_organization_is_invisible_to_non_members(client):
    """Tenancy is enforced by the query: a stranger gets a 404, not a 403.

    A 403 would confirm that the organization exists, which leaks the tenant map
    to anyone who can guess an id.
    """
    owner_token = mint_token()
    stranger_token = mint_token()
    organization = await _create_organization(client, owner_token)

    listed = await client.get("/v1/organizations", headers=auth_header(stranger_token))
    assert listed.status_code == 200
    assert listed.json()["total"] == 0

    read = await client.get(
        f"/v1/organizations/{organization['id']}", headers=auth_header(stranger_token)
    )
    assert read.status_code == 404

    members = await client.get(
        f"/v1/organizations/{organization['id']}/members", headers=auth_header(stranger_token)
    )
    assert members.status_code == 404


async def test_an_unknown_organization_is_a_404(client):
    token = mint_token()

    response = await client.get(f"/v1/organizations/{uuid.uuid4()}", headers=auth_header(token))

    assert response.status_code == 404


async def test_members_see_organizations_they_do_not_own(client, db_session):
    owner_token = mint_token(email="owner@example.com")
    member_token = mint_token(email="member@example.com")
    organization = await _create_organization(client, owner_token)

    # Provision the second profile, then add it the way an invitation would.
    await client.get("/v1/users/me", headers=auth_header(member_token))
    member = await db_session.scalar(select(User).where(User.email == "member@example.com"))
    db_session.add(
        Membership(
            user_id=member.id,
            organization_id=uuid.UUID(organization["id"]),
            role="member",
        )
    )
    await db_session.commit()

    response = await client.get("/v1/organizations", headers=auth_header(member_token))

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["role"] == "member"


async def test_organizations_with_the_same_name_get_distinct_slugs(client):
    token = mint_token()

    first = await _create_organization(client, token, name="Acme")
    second = await _create_organization(client, token, name="Acme")

    assert first["slug"] == "acme"
    assert second["slug"] == "acme-2"


async def test_organizations_are_paginated(client):
    token = mint_token()
    for name in ("Alpha", "Bravo", "Charlie"):
        await _create_organization(client, token, name=name)

    response = await client.get("/v1/organizations?limit=2", headers=auth_header(token))

    body = response.json()
    assert body["total"] == 3  # total ignores pagination
    assert body["limit"] == 2
    assert len(body["items"]) == 2


async def test_an_unknown_sort_field_is_rejected(client):
    token = mint_token()

    response = await client.get("/v1/organizations?sort=nope", headers=auth_header(token))

    assert response.status_code == 422


async def test_an_unknown_query_parameter_is_rejected(client):
    """List parameters are validated together, so a typo is a 422, not ignored."""
    token = mint_token()

    response = await client.get("/v1/organizations?limt=2", headers=auth_header(token))

    assert response.status_code == 422


async def test_an_empty_name_is_rejected(client):
    token = mint_token()

    response = await client.post("/v1/organizations", json={"name": ""}, headers=auth_header(token))

    assert response.status_code == 422


async def test_deleting_a_profile_removes_its_memberships(client, db_session):
    """The foreign key cascades, so a hard delete leaves no dangling rows."""
    token = mint_token()
    await _create_organization(client, token)

    assert (await client.delete("/v1/users/me", headers=auth_header(token))).status_code == 204

    remaining = await db_session.scalar(select(func.count()).select_from(Membership))
    assert remaining == 0

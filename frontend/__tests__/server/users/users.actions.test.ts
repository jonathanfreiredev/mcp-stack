// @vitest-environment node
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { server } from "../../msw/server";

vi.mock("@/server/auth/auth.lib", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { getSession } from "@/server/auth/auth.lib";
import { createClient } from "@/lib/supabase/server";
import { updateUserAction } from "@/server/users/users.actions";

const BACKEND_URL = "http://backend.test";
const USER_EMAIL = "user@example.com";

beforeEach(() => {
  // `protectedProcedure` resolves the session through `getSession`.
  vi.mocked(getSession).mockResolvedValue({
    session: { token: "token", expiresAt: null },
    user: { id: "user-id", email: USER_EMAIL, name: "User", isVerified: true },
  });

  // The action only touches `auth.getUser` when the email is unchanged.
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { email: USER_EMAIL } },
      }),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
});

describe("updateUserAction", () => {
  test("returns the profile updated by the backend", async () => {
    server.use(
      http.patch(`${BACKEND_URL}/users/me`, () =>
        HttpResponse.json({ full_name: "New Name" }),
      ),
    );

    const result = await updateUserAction({ name: "New Name", email: USER_EMAIL });

    expect(result.serverError).toBeUndefined();
    expect(result.data).toEqual({
      success: true,
      user: { full_name: "New Name" },
    });
  });

  test("surfaces a string backend error message", async () => {
    server.use(
      http.patch(`${BACKEND_URL}/users/me`, () =>
        HttpResponse.json({ detail: "Not allowed" }, { status: 403 }),
      ),
    );

    const result = await updateUserAction({ name: "New Name", email: USER_EMAIL });

    expect(result.serverError?.code).toBe(403);
    expect(result.serverError?.message).toBe("Not allowed");
  });

  test("normalises a FastAPI validation error list into a string message", async () => {
    server.use(
      http.patch(`${BACKEND_URL}/users/me`, () =>
        HttpResponse.json(
          {
            detail: [
              {
                loc: ["body", "full_name"],
                msg: "String should have at least 2 characters",
                type: "string_too_short",
              },
            ],
          },
          { status: 422 },
        ),
      ),
    );

    const result = await updateUserAction({ name: "New Name", email: USER_EMAIL });

    expect(result.serverError?.code).toBe(422);
    expect(result.serverError?.message).toBe(
      "String should have at least 2 characters",
    );
  });
});

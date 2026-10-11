import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./__tests__/msw/server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

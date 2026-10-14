"use server";

import { returnServerError } from "next-safe-action";
import { z } from "zod";

import { env } from "@/lib/env";
import { publicProcedure } from "@/lib/safe-action";
import { getSession } from "@/server/auth/auth.lib";

const runDemoSchema = z.object({
  // Both are set when the visitor is answering a run that stopped to ask them
  // something: the id is the run, and the decision is the answer.
  thread_id: z.string().max(64).optional(),
  decision: z.enum(["accept", "reject"]).optional(),
});

/**
 * Run the playground once, or carry on with a run that stopped to ask something.
 *
 * Public on purpose: the half of the demo worth watching is what the MCP door does
 * when nobody is signed in. The session token rides along when there is one and the
 * backend reports the refusal when there is not, so the browser never sees the token
 * and the refusal is the server's answer rather than ours.
 */
export const runDemoAction = publicProcedure
  .inputSchema(runDemoSchema)
  .action(async ({ parsedInput }) => {
    const session = await getSession();

    const response = await fetch(`${env.BACKEND_URL}/v1/demo/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session ? { Authorization: `Bearer ${session.session.token}` } : {}),
      },
      body: JSON.stringify(parsedInput),
      cache: "no-store",
    });

    if (!response.ok) {
      returnServerError({
        code: response.status,
        message: "The playground could not reach the API.",
      });
    }

    return await response.json();
  });

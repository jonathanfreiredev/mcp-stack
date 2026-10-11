"use server";

import { returnServerError } from "next-safe-action";

import { backendErrorMessage } from "@/lib/api-error";
import { env } from "@/lib/env";
import { protectedProcedure } from "@/lib/safe-action";
import { createClient } from "@/lib/supabase/server";
import { updateUserPasswordSchema, updateUserSchema } from "./users.schemas";

export const updateUserAction = protectedProcedure
  .inputSchema(updateUserSchema)
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Email lives in Supabase; changing it triggers a confirmation email.
    if (user && parsedInput.email !== user.email) {
      const { error } = await supabase.auth.updateUser({
        email: parsedInput.email,
      });

      if (error) {
        returnServerError({ code: error.status ?? 400, message: error.message });
      }
    }

    // The name is domain data owned by the backend.
    const response = await fetch(`${env.BACKEND_URL}/users/me`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.session.token}`,
      },
      body: JSON.stringify({ full_name: parsedInput.name }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      returnServerError({
        code: response.status,
        message: backendErrorMessage(
          errorData.detail,
          "An error occurred while updating the profile.",
        ),
      });
    }

    return { success: true, user: await response.json() };
  });

export const updateUserPasswordAction = protectedProcedure
  .inputSchema(updateUserPasswordSchema.omit({ confirmNewPassword: true }))
  .action(async ({ parsedInput, ctx }) => {
    const supabase = await createClient();

    // Re-authenticate with the current password before changing it.
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: ctx.user.email,
      password: parsedInput.currentPassword,
    });

    if (reauthError) {
      returnServerError({ code: 400, message: "Incorrect current password." });
    }

    const { error } = await supabase.auth.updateUser({
      password: parsedInput.newPassword,
    });

    if (error) {
      returnServerError({ code: error.status ?? 400, message: error.message });
    }

    return { success: true };
  });

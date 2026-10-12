"use client";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { updateUserAction } from "@/server/users/users.actions";
import { updateUserSchema } from "@/server/users/users.schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "../ui/field";
import { Input } from "../ui/input";
import { ChangePasswordForm } from "./change-password-form";
import { DeleteAccountForm } from "./delete-account-form";

export const ProfileForm = ({
  user,
  className,
  ...props
}: React.ComponentProps<"div"> & { user: { name: string; email: string } }) => {
  const router = useRouter();

  const form = useForm<z.infer<typeof updateUserSchema>>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      name: user.name,
      email: user.email,
    },
  });

  async function onSubmit(data: z.infer<typeof updateUserSchema>) {
    const res = await updateUserAction(data);

    if (res.serverError) {
      toast.add({
        title: "Profile update failed!",
        description:
          res.serverError.message ||
          "An error occurred while updating profile.",
        type: "error",
      });
      return;
    }

    toast.add({
      title: "Profile updated successfully!",
      description: "Your profile information has been updated.",
      type: "success",
    });

    form.reset(data);
    router.refresh();
  }

  return (
    <div
      className={cn("flex w-full max-w-125 flex-col gap-6", className)}
      {...props}
    >
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">My Profile</CardTitle>
          <CardDescription>
            Update your profile information, such as your name and email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form id="form-profile" onSubmit={form.handleSubmit(onSubmit)}>
            <FieldSet className="mb-5 w-full">
              <FieldGroup>
                <Controller
                  name="name"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="name">Name</FieldLabel>
                      <Input
                        {...field}
                        id="name"
                        type="text"
                        autoComplete="off"
                        placeholder="John Doe"
                        required
                      />

                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <Controller
                  name="email"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="email">Email</FieldLabel>
                      <Input
                        {...field}
                        id="email"
                        type="email"
                        placeholder="joe@example.com"
                        required
                      />
                      <FieldDescription>
                        Choose a unique email for your account.
                      </FieldDescription>

                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </FieldGroup>
            </FieldSet>

            <Field>
              <Button
                type="submit"
                form="form-profile"
                disabled={form.formState.isSubmitting}
              >
                Update Profile
              </Button>
            </Field>
          </form>
        </CardContent>

        <CardFooter className="flex justify-end gap-2">
          <Dialog>
            <DialogTrigger
              render={
                <Button variant="link" disabled={form.formState.isSubmitting}>
                  Change password
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Change password</DialogTitle>
                <DialogDescription>
                  Enter your new password below to change your password.
                </DialogDescription>
              </DialogHeader>

              <ChangePasswordForm />
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger
              render={
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={form.formState.isSubmitting}
                >
                  Delete account
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Delete account</DialogTitle>
                <DialogDescription>
                  This permanently deletes your account and profile, and cannot
                  be undone. Enter your password to confirm.
                </DialogDescription>
              </DialogHeader>

              <DeleteAccountForm />
            </DialogContent>
          </Dialog>
        </CardFooter>
      </Card>
    </div>
  );
};

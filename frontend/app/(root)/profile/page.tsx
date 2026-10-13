import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/auth/profile-form";
import { getSession } from "@/server/auth/auth.lib";
import { listConnectedApps } from "@/server/oauth/oauth.lib";

export default async function ProfilePage() {
  const session = await getSession();

  const isLoggedIn = !!session;

  if (!isLoggedIn) {
    redirect("/auth/login");
  }

  const connectedApps = await listConnectedApps();

  return (
    <div className="flex w-full flex-col items-center px-4 py-8">
      <ProfileForm
        user={{
          name: session?.user.name || "",
          email: session?.user.email || "",
        }}
        connectedApps={connectedApps}
      />
    </div>
  );
}

import { DiagramSection } from "@/components/landing/diagram-section";
import { Hero } from "@/components/landing/hero";
import { Loop } from "@/components/landing/loop";
import { StackList } from "@/components/landing/stack-list";
import { getSession } from "@/server/auth/auth.lib";

/**
 * The public landing.
 *
 * It lives inside `(root)` on purpose: that layout already brings the nav and
 * the footer, and its breadcrumb hides itself when the trail has a single crumb,
 * which is the case at the root.
 */
export default async function HomePage() {
  const session = await getSession();

  return (
    <>
      <Hero isSignedIn={!!session} />
      <DiagramSection />
      <StackList />
      <Loop />
    </>
  );
}

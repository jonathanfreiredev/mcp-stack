import { ConnectAgent } from "@/components/landing/connect-agent";
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
 *
 * The order follows the reader: what this is, how the two doors work, what is
 * inside, how to run it, and finally how to point a given client at it.
 */
export default async function HomePage() {
  const session = await getSession();

  return (
    <>
      <Hero isSignedIn={!!session} />
      <DiagramSection />
      <StackList />
      <Loop />
      <ConnectAgent />
    </>
  );
}

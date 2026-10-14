import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Button } from "@/components/ui/button";
import { BackgroundCircles } from "@/components/background-circles";
import { getSession } from "@/server/auth/auth.lib";

const technologies = [
  "Next.js 16",
  "FastAPI",
  "SQLAlchemy",
  "PostgreSQL",
  "OAuth 2.0",
  "next-safe-action",
  "Tailwind 4",
  "Zod",
];

const cx = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export default async function HomePage() {
  const session = await getSession();
  const isLoggedIn = !!session;
  const userName = session?.user.name;

  return (
    <section className="relative isolate flex min-h-svh flex-col overflow-x-clip">
      <BackgroundCircles />

      <div className="flex flex-1 items-center justify-center px-4 pt-[var(--header-height)] pb-8 sm:px-6 lg:px-8">
        <div className="w-full max-w-5xl space-y-8 text-center">
          {isLoggedIn ? (
            <div className="border-border/70 bg-background/70 text-muted-foreground mx-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium backdrop-blur-sm">
              <Sparkles className="text-primary size-3.5" />
              <span>{`Hello ${userName ?? "there"}`}</span>
            </div>
          ) : null}

          <div className="space-y-4">
            <h1
              className={cx(
                "text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl lg:text-7xl",
                "from-foreground via-primary bg-linear-to-r to-emerald-400 bg-clip-text text-transparent",
              )}
            >
              MCPStack
            </h1>
            <p className="text-muted-foreground mx-auto max-w-2xl text-sm text-pretty sm:text-base md:text-lg">
              A modern full-stack starter template for building web
              applications.
            </p>
          </div>

          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2">
            {technologies.map((tech) => (
              <span
                key={tech}
                className="border-border/70 bg-background/70 text-foreground/90 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium backdrop-blur-sm"
              >
                {tech}
              </span>
            ))}
          </div>

          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="https://github.com/jonathanfreiredev/mcp-stack"
              target="_blank"
              rel="noreferrer"
            >
              <Button size="lg" className="w-full sm:w-auto">
                Get Started
                <ArrowRight className="size-4" />
              </Button>
            </Link>

            {!isLoggedIn ? (
              <Link href="/auth/signup">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  Sign up
                </Button>
              </Link>
            ) : null}
          </div>

          <p className="text-muted-foreground/90 text-xs sm:text-sm">
            {isLoggedIn
              ? "You are authenticated and ready to ship."
              : "Sign in to unlock the complete starter experience."}
          </p>
        </div>
      </div>
    </section>
  );
}

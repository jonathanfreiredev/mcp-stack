"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";

/** Two lines, so the block stays readable at the width of the hero copy. */
const COMMAND = [
  "git clone https://github.com/jonathanfreiredev/mcp-stack",
  "cd mcp-stack && cp .env.example .env && docker compose up",
].join("\n");

const TYPING_INTERVAL_MS = 16;
const TYPING_STEP = 2;
const COPIED_FEEDBACK_MS = 1800;

type CopyState = "idle" | "copied" | "error";

/**
 * The command, offered in the form it is actually used: typeable and copyable.
 *
 * It types itself once on arrival, which is the page's one authored motion, and
 * that is why the visible text is marked decorative and the real command travels
 * in a screen-reader copy underneath: the DOM must not be one character long
 * while the animation runs.
 */
export function CommandBlock() {
  const prefersReducedMotion = useReducedMotion();
  const [typed, setTyped] = useState("");
  const [copyState, setCopyState] = useState<CopyState>("idle");

  useEffect(() => {
    // Reduced motion takes the same path with an instant step, so the command
    // never arrives through an animation and no state is set during the effect
    // body itself.
    const step = prefersReducedMotion ? COMMAND.length : TYPING_STEP;
    const interval = prefersReducedMotion ? 0 : TYPING_INTERVAL_MS;

    let cursor = 0;
    const timer = window.setInterval(() => {
      cursor += step;
      setTyped(COMMAND.slice(0, cursor));
      if (cursor >= COMMAND.length) {
        window.clearInterval(timer);
      }
    }, interval);

    return () => window.clearInterval(timer);
  }, [prefersReducedMotion]);

  const isTyping = typed.length < COMMAND.length;

  async function copy() {
    if (!navigator.clipboard) {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), COPIED_FEEDBACK_MS);
      return;
    }

    try {
      await navigator.clipboard.writeText(COMMAND);
      setCopyState("copied");
    } catch {
      // Denied permission or an insecure context. Say so instead of pretending.
      setCopyState("error");
    }

    window.setTimeout(() => setCopyState("idle"), COPIED_FEEDBACK_MS);
  }

  const label =
    copyState === "copied"
      ? "Copied"
      : copyState === "error"
        ? "Copy failed"
        : "Copy the commands";

  return (
    <div className="border-border relative rounded-xl border p-5">
      <div className="flex items-start justify-between gap-6">
        <pre
          aria-hidden="true"
          className="min-w-0 font-mono text-xs leading-6 break-words whitespace-pre-wrap sm:text-sm"
        >
          {typed}
          {isTyping ? (
            <span className="bg-foreground inline-block h-4 w-2 translate-y-0.5" />
          ) : null}
        </pre>

        <span className="sr-only">{COMMAND}</span>

        <motion.div whileTap={{ scale: 0.94 }}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={copy}
            aria-label={label}
            title={label}
            className="-mt-1 shrink-0"
          >
            {copyState === "copied" ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

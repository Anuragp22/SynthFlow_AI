"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import { Button } from "~/components/ui/button";

const SEEN_KEY = "zenco-docs-guide-dismissed";

/**
 * "How to read this" — a modeless orientation panel.
 *
 * Deliberately NOT a step-through coach-mark tour. The coachmarks pattern is
 * widely treated as a borderline anti-pattern: overlays obstruct the very
 * elements they describe, and users mid-task dismiss them without reading. The
 * recommended alternative is modeless assistance — help you can read while
 * still interacting with the page — so this sits inline, blocks nothing, and
 * can be reopened at any time from the header.
 *
 * Held to four points, which is roughly the limit of what anyone retains from
 * an orientation aid.
 */
const POINTS: readonly { n: string; title: string; body: string }[] = [
  {
    n: "1",
    title: "Read left, then right",
    body: "The left card is the mechanism — a diagram or a small model you can poke at. The right card explains why it is built that way, and ends with what it still gets wrong.",
  },
  {
    n: "2",
    title: "Every diagram has a key",
    body: "Under each diagram is a key decoding the shapes, line styles and colours. Nothing in a diagram is meant to be guessed at.",
  },
  {
    n: "3",
    title: "The controls change the answer",
    body: "Buttons above a diagram are not decoration. Choosing a different mode or failure genuinely re-runs the explanation, and the choice follows you into later stages.",
  },
  {
    n: "4",
    title: "Go in order, or don't",
    body: "The five parts across the top build on each other, so front-to-back is the intended path. Arrow keys move between stages. Any unfamiliar term is in the glossary.",
  },
];

export function HowToRead({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  // First visit opens it; after that the reader's choice is remembered.
  React.useEffect(() => {
    try {
      if (!window.localStorage.getItem(SEEN_KEY)) onOpenChange(true);
    } catch {
      /* private mode / storage disabled — just leave it closed */
    }
  }, [onOpenChange]);

  const dismiss = React.useCallback(() => {
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.section
          key="guide"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          className="shrink-0 overflow-hidden"
          aria-label="How to read this document"
        >
          <div className="bg-muted/40 mx-3 mt-3 rounded-xl border md:mx-4">
            <div className="flex items-start justify-between gap-3 px-4 pt-3">
              <div>
                <h2 className="text-sm font-semibold">
                  New here? How to read this
                </h2>
                <p className="text-muted-foreground text-xs">
                  It explains how one text prompt becomes a three-minute song —
                  and where the design is weak. No prior knowledge assumed.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={dismiss}
                aria-label="Dismiss guide"
              >
                <X />
              </Button>
            </div>
            <ul className="grid gap-3 px-4 pt-3 pb-4 sm:grid-cols-2 lg:grid-cols-4">
              {POINTS.map((p) => (
                <li key={p.n} className="flex gap-2.5">
                  <span className="bg-primary text-primary-foreground grid size-5 shrink-0 place-items-center rounded font-mono text-[10px] font-semibold">
                    {p.n}
                  </span>
                  <span className="text-[12px] leading-snug">
                    <span className="font-semibold">{p.title}</span>
                    <span className="text-muted-foreground"> — {p.body}</span>
                  </span>
                </li>
              ))}
            </ul>
            {/* Document-level scope note. Previously stapled to the first
                stage's limitation box, where it read as a limitation of that
                stage rather than of the whole document. */}
            <p className="text-muted-foreground border-t px-4 py-2.5 text-[11.5px] leading-snug">
              <span className="text-foreground font-semibold">Scope —</span>{" "}
              this describes the code as committed. Nothing here is measured:
              the repository contains no benchmarks or load tests, so every
              performance claim is reasoning about code shape. Inngest and Modal
              behaviour comes from their configuration here plus their
              documented semantics, not from production traces. The frontend
              appears only where it participates in the architecture.
            </p>
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}

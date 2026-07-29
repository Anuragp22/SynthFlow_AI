"use client";

import * as React from "react";
import { CornerDownRight } from "lucide-react";

import { cn } from "~/lib/utils";

/**
 * Jumping between stages.
 *
 * The document has one rule about repetition: a fact is stated in exactly one
 * stage, and every other stage that needs it links here instead. That only
 * works if the link actually goes somewhere, so navigation is exposed through
 * a context the shell fills in.
 *
 * Rendering degrades rather than breaking: outside the shell (or in a stage
 * rendered standalone) a StageLink is plain text, not a dead button.
 */
export type StageNav = (stageId: string) => void;

export interface StageNavApi {
  go: StageNav;
  /** Human label for a stage id, so callers never hard-code one. */
  labelOf: (stageId: string) => string | null;
}

const StageNavContext = React.createContext<StageNavApi | null>(null);

export function StageNavProvider({
  goToStage,
  labelOf,
  children,
}: {
  goToStage: StageNav;
  labelOf: (stageId: string) => string | null;
  children: React.ReactNode;
}) {
  const value = React.useMemo<StageNavApi>(
    () => ({ go: goToStage, labelOf }),
    [goToStage, labelOf],
  );
  return (
    <StageNavContext.Provider value={value}>
      {children}
    </StageNavContext.Provider>
  );
}

export function useStageNav(): StageNavApi | null {
  return React.useContext(StageNavContext);
}

export function StageLink({
  to,
  children,
  className,
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
}) {
  const nav = useStageNav();
  if (!nav) return <>{children}</>;
  const label = nav.labelOf(to);
  return (
    <button
      type="button"
      onClick={() => nav.go(to)}
      title={label ? `Go to “${label}”` : "Go to the stage that covers this"}
      className={cn(
        "text-primary decoration-primary/40 hover:decoration-primary inline items-baseline gap-0.5 underline underline-offset-2",
        className,
      )}
    >
      {children}
      <CornerDownRight className="ml-0.5 inline size-3 align-[-0.1em]" />
    </button>
  );
}

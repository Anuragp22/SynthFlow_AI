"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion, useSpring } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  X,
} from "lucide-react";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { ACTS, GLOSSARY, TOTAL_STAGES, type Stage } from "./content";
import { DocsProvider } from "./docs-context";
import { HowToRead } from "./how-to-read";
import { Prose, inline } from "./prose";
import { StageNavProvider } from "./stage-link";

const RAIL_KEY = "zenco-docs-rail-open";

/**
 * Rail-collapsed preference, as an external store.
 *
 * /docs is statically prerendered, so the server has no localStorage to read.
 * useSyncExternalStore is the sanctioned way to reconcile that: the server
 * snapshot is "open", the client snapshot is whatever was stored, and React
 * settles the difference after hydration without a setState-in-effect.
 */
const railListeners = new Set<() => void>();

function readRail() {
  try {
    return window.localStorage.getItem(RAIL_KEY) !== "0";
  } catch {
    return true;
  }
}

function subscribeRail(cb: () => void) {
  railListeners.add(cb);
  return () => {
    railListeners.delete(cb);
  };
}

function writeRail(open: boolean) {
  try {
    window.localStorage.setItem(RAIL_KEY, open ? "1" : "0");
  } catch {
    /* storage disabled — the toggle still works for this visit */
  }
  railListeners.forEach((cb) => cb());
}

/**
 * The location hash, as an external store.
 *
 * Same reason as the rail preference: /docs is prerendered, so the server has
 * no URL fragment to read. The server snapshot is empty — which resolves to
 * the first stage — and the client reconciles after hydration.
 */
function readHash() {
  return typeof window === "undefined"
    ? ""
    : decodeURIComponent(window.location.hash.slice(1));
}

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  window.addEventListener("popstate", cb);
  return () => {
    window.removeEventListener("hashchange", cb);
    window.removeEventListener("popstate", cb);
  };
}

/** Resolve a stage id to its act and position. Unknown ids fall back to first. */
function locateStage(stageId: string) {
  for (const a of ACTS) {
    const idx = a.stages.findIndex((s) => s.id === stageId);
    if (idx !== -1) return { act: a, current: idx };
  }
  return { act: ACTS[0]!, current: 0 };
}

/**
 * The walkthrough shell.
 *
 * Deliberately a fixed-viewport app rather than a scrolling document: the two
 * things that tell you where you are — the act bar and the stage rail — must
 * never leave the screen. Only the two content columns scroll, and only when
 * their own content overflows.
 */

function StageRail({
  stages,
  current,
  onPick,
  collapsed,
  onToggle,
}: {
  stages: readonly Stage[];
  current: number;
  onPick: (i: number) => void;
  /** Numbers only, ~2rem wide — navigation survives, the width does not. */
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <nav aria-label="Stages" className="min-h-0 overflow-y-auto pr-1">
      {/* The control that collapses this list lives on the list, not in the
          global header — that is where a reader looks for it. */}
      <div
        className={cn(
          "mb-1.5 flex items-center",
          collapsed ? "justify-center" : "justify-between pl-1",
        )}
      >
        {collapsed ? null : (
          <span className="text-muted-foreground font-mono text-[9.5px] font-semibold tracking-widest uppercase">
            Stages
          </span>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={collapsed}
          aria-label={
            collapsed ? "Expand the stage list" : "Collapse the stage list"
          }
          title={
            collapsed
              ? "Expand the stage list"
              : "Collapse the stage list — gives the diagram more room"
          }
          className="text-muted-foreground hover:bg-muted hover:text-foreground grid size-6 shrink-0 place-items-center rounded-md transition-colors max-lg:hidden"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-3.5" />
          ) : (
            <PanelLeftClose className="size-3.5" />
          )}
        </button>
      </div>
      <LayoutGroup id="rail">
        <ol className="flex flex-col gap-px">
          {stages.map((s, i) => {
            const active = i === current;
            return (
              <li key={s.id} className="relative">
                <button
                  type="button"
                  onClick={() => onPick(i)}
                  aria-current={active ? "step" : undefined}
                  title={collapsed ? s.label : undefined}
                  className={cn(
                    "relative flex w-full items-center rounded-md text-left",
                    collapsed
                      ? "justify-center px-0 py-1"
                      : "gap-2 px-2 py-1.5",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="rail-marker"
                      transition={{
                        type: "spring",
                        stiffness: 520,
                        damping: 42,
                      }}
                      className="bg-muted absolute inset-0 rounded-md"
                    />
                  ) : null}
                  <span
                    className={cn(
                      "relative z-1 grid size-5 shrink-0 place-items-center rounded border font-mono text-[10px] font-semibold",
                      active
                        ? "bg-primary text-primary-foreground border-transparent"
                        : "bg-muted/60 text-muted-foreground",
                    )}
                  >
                    {i + 1}
                  </span>
                  {collapsed ? null : (
                    <span
                      className={cn(
                        "relative z-1 text-[12.5px] leading-tight",
                        active
                          ? "text-foreground font-semibold"
                          : "text-muted-foreground",
                      )}
                    >
                      {s.label}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </LayoutGroup>
    </nav>
  );
}

function ArgumentPanel({ stage }: { stage: Stage }) {
  return (
    <aside className="bg-card min-h-0 overflow-y-auto rounded-xl border p-4 shadow-sm md:p-5">
      <h3 className="text-muted-foreground mb-2 font-mono text-[11px] font-semibold tracking-widest uppercase">
        The architectural argument
      </h3>
      <Prose paragraphs={stage.argument} />
      <div className="mt-4 rounded-lg border border-[color:var(--chart-5)]/40 bg-[color:var(--chart-5)]/10 px-3.5 py-3">
        <div className="mb-1.5 font-mono text-[10px] font-semibold tracking-widest text-[color:var(--chart-5)] uppercase">
          Honest limitations
        </div>
        <ul className="text-muted-foreground list-disc space-y-1.5 pl-4 text-[13px]">
          {stage.limits.map((l, i) => (
            <li key={i}>{inline(l, `lim${i}`)}</li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function GlossaryDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="scrim"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/35"
          />
          <motion.aside
            key="drawer"
            role="dialog"
            aria-label="Glossary"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
            className="bg-background fixed inset-y-0 right-0 z-41 flex w-[min(560px,92vw)] flex-col border-l"
          >
            <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
              <b className="text-sm">Glossary — terms used throughout</b>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X />
              </Button>
            </div>
            <div className="grid min-h-0 gap-3 overflow-y-auto px-4 py-4">
              {GLOSSARY.map(([term, def]) => (
                <div key={term}>
                  <div className="text-primary font-mono text-[12.5px] font-semibold">
                    {term}
                  </div>
                  <div className="text-muted-foreground text-[12.5px] leading-relaxed">
                    {def}
                  </div>
                </div>
              ))}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function Progress({ value }: { value: number }) {
  const scaleX = useSpring(0, {
    stiffness: 180,
    damping: 26,
    restDelta: 0.001,
  });
  React.useEffect(() => {
    scaleX.set(value);
  }, [value, scaleX]);
  return (
    <div className="bg-border h-0.5 shrink-0">
      <motion.div
        style={{ scaleX, transformOrigin: "0% 50%" }}
        className="bg-primary h-full"
      />
    </div>
  );
}

export function DocsShell() {
  const [replay, setReplay] = React.useState(0);
  const [glossary, setGlossary] = React.useState(false);
  const [guide, setGuide] = React.useState(false);
  const railOpen = React.useSyncExternalStore(
    subscribeRail,
    readRail,
    () => true,
  );
  const toggleRail = React.useCallback(() => writeRail(!readRail()), []);

  /**
   * The URL is the source of truth for which stage is open.
   *
   * Cross-links made this necessary: once a band on the map can throw you into
   * a different act, "how do I get back" has to have an answer, and the only
   * answer a reader will actually try is the browser's Back button. Holding
   * the stage in React state alone made Back leave the document entirely.
   *
   * Assigning to location.hash both pushes a history entry and fires
   * hashchange, so Back, Forward, reload and a pasted link all work without
   * any of them being handled separately. It also makes every stage
   * addressable: /docs#dualwrite is a link someone can send.
   */
  const hash = React.useSyncExternalStore(subscribeHash, readHash, () => "");
  const { act, current } = locateStage(hash);
  const stage = act.stages[current] ?? act.stages[0]!;

  /**
   * Jump to any stage by id, from anywhere.
   *
   * This is what makes the no-duplication rule workable: a fact lives in one
   * stage and the others link to it, including the boxes on the architecture
   * map. An unknown id resolves to the first stage rather than throwing, so a
   * stale link degrades instead of taking the page down.
   */
  const goToStage = React.useCallback((stageId: string) => {
    window.location.hash = stageId;
  }, []);

  // Plain functions: both close over the derived act, and hand-memoizing them
  // only stops the React Compiler from doing it properly.
  const pickAct = (id: string) => {
    const a = ACTS.find((x) => x.id === id);
    if (a?.stages[0]) goToStage(a.stages[0].id);
  };
  const pickStage = (i: number) => {
    const s = act.stages[i];
    if (s) goToStage(s.id);
  };

  /** Resolve a stage id to its rail label, so no caller hard-codes one. */
  const stageLabel = React.useCallback(
    (stageId: string) =>
      ACTS.flatMap((a) => a.stages).find((s) => s.id === stageId)?.label ??
      null,
    [],
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /input|textarea/i.test(el.tagName)) return;
      // Resolve against `act` directly rather than through pickStage: `act` is
      // a stable reference out of ACTS, so the listener is attached once per
      // stage instead of once per render.
      const step = (d: number) => {
        e.preventDefault();
        const next =
          act.stages[Math.min(Math.max(current + d, 0), act.stages.length - 1)];
        if (next) goToStage(next.id);
      };
      if (e.key === "ArrowDown" || e.key === "ArrowRight") step(1);
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, act, goToStage]);

  const done =
    ACTS.slice(0, ACTS.indexOf(act)).reduce((n, a) => n + a.stages.length, 0) +
    current +
    1;

  const Mech = stage.Mech;

  return (
    <StageNavProvider goToStage={goToStage} labelOf={stageLabel}>
      <DocsProvider>
        <div className="flex h-dvh flex-col overflow-hidden max-lg:h-auto max-lg:overflow-visible">
          <header className="bg-background relative z-20 flex h-12.5 shrink-0 items-center gap-3 border-b px-3 md:px-4">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1.5 text-xs"
            >
              <ArrowLeft className="size-3.5" />
              <span className="hidden sm:inline">ZENCO</span>
            </Link>
            <span className="bg-border h-4 w-px shrink-0" />
            <nav
              aria-label="Parts"
              className="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <LayoutGroup id="acts">
                {ACTS.map((a) => {
                  const active = a.id === act.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      title={a.summary}
                      aria-pressed={active}
                      onClick={() => pickAct(a.id)}
                      className={cn(
                        "relative shrink-0 rounded-md px-2.5 py-1.5 text-[12.5px] whitespace-nowrap",
                        active
                          ? "text-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {active ? (
                        <motion.span
                          layoutId="act-glow"
                          transition={{
                            type: "spring",
                            stiffness: 480,
                            damping: 40,
                          }}
                          className="bg-muted absolute inset-0 rounded-md border"
                        />
                      ) : null}
                      <span
                        className={cn(
                          "relative z-1 mr-1.5 font-mono text-[9px] tracking-widest",
                          active ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {a.numeral}
                      </span>
                      <span className="relative z-1">{a.title}</span>
                    </button>
                  );
                })}
              </LayoutGroup>
            </nav>
            <div className="flex shrink-0 gap-1.5">
              <Button
                variant={guide ? "default" : "outline"}
                size="sm"
                aria-pressed={guide}
                onClick={() => setGuide((g) => !g)}
                title="How to read this document"
              >
                <HelpCircle />
                <span className="hidden md:inline">how to read</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setGlossary(true)}
              >
                <BookOpen />
                <span className="hidden md:inline">glossary</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReplay((r) => r + 1)}
                title="Replay this stage's animation"
              >
                <RotateCcw />
                <span className="hidden md:inline">replay</span>
              </Button>
            </div>
          </header>

          <Progress value={done / TOTAL_STAGES} />

          <HowToRead open={guide} onOpenChange={setGuide} />

          <div
            className={cn(
              "grid min-h-0 flex-1 gap-4 px-3 pt-3.5 pb-4 max-lg:grid-cols-1 md:px-4",
              railOpen
                ? "grid-cols-[198px_minmax(0,1fr)]"
                : "grid-cols-[34px_minmax(0,1fr)]",
            )}
          >
            <StageRail
              stages={act.stages}
              current={current}
              onPick={pickStage}
              collapsed={!railOpen}
              onToggle={toggleRail}
            />

            <div className="flex min-h-0 flex-col gap-2.5">
              {/* A full-width stage gets no heading block — the diagram is the
                content, and the title, lead and source chips would only take
                vertical space away from it. */}
              {stage.full ? null : (
                <div className="shrink-0">
                  <h2 className="text-[19px] leading-tight font-semibold tracking-tight">
                    {stage.title}
                  </h2>
                  {/* Plain-language lead: the one line a newcomer reads before
                    deciding whether the rest is worth their attention. */}
                  <p className="text-muted-foreground mt-1 max-w-[80ch] text-[13.5px] leading-snug">
                    {stage.plain}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {stage.sources.map((s) => (
                      <span
                        key={s}
                        className="bg-muted/60 text-muted-foreground rounded border px-1.5 py-1 font-mono text-[10.5px]"
                      >
                        {s}
                      </span>
                    ))}
                    <span className="bg-muted/60 text-muted-foreground ml-auto rounded border px-1.5 py-1 font-mono text-[10.5px]">
                      {done} / {TOTAL_STAGES}
                    </span>
                  </div>
                </div>
              )}

              <AnimatePresence mode="wait">
                <motion.section
                  key={stage.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className={cn(
                    "grid min-h-0 flex-1 gap-4 max-xl:grid-cols-1",
                    stage.full
                      ? "grid-cols-1"
                      : "grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]",
                  )}
                >
                  <div
                    data-mech={stage.id}
                    className={cn(
                      "bg-card min-h-0 overflow-x-hidden rounded-xl border p-4 shadow-sm",
                      // A full-width stage sizes its diagram to the box instead
                      // of scrolling inside it.
                      stage.full
                        ? "flex flex-col overflow-y-hidden max-lg:h-[70vh]"
                        : "overflow-y-auto",
                    )}
                  >
                    <Mech key={replay} />
                  </div>
                  {stage.full ? null : <ArgumentPanel stage={stage} />}
                </motion.section>
              </AnimatePresence>
            </div>
          </div>

          <GlossaryDrawer open={glossary} onClose={() => setGlossary(false)} />
        </div>
      </DocsProvider>
    </StageNavProvider>
  );
}

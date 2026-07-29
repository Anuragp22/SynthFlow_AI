"use client";

import * as React from "react";

import { cn } from "~/lib/utils";
import { TONE } from "./primitives";

/**
 * Diagram key.
 *
 * The C4 model's notation guidance is explicit that "every diagram should have
 * a key/legend explaining the notation being used (e.g. shapes, colours, border
 * styles, line types, arrow heads)", and that acronyms must be either
 * universally understood or explained in the key. Without one a reader is
 * inferring what the shapes mean — which means they can be wrong and never find
 * out.
 *
 * Swatches deliberately vary by SHAPE as well as colour, so the key still reads
 * correctly for anyone who cannot distinguish the hues.
 */
export type SwatchKind =
  | "box"
  | "dashedBox"
  | "line"
  | "dashedLine"
  | "dot"
  | "band"
  | "text";

export interface LegendItem {
  kind: SwatchKind;
  color?: string;
  label: string;
  means: string;
}

function Swatch({ kind, color }: { kind: SwatchKind; color: string }) {
  switch (kind) {
    case "box":
      return (
        <svg width="22" height="12" aria-hidden className="shrink-0">
          <rect
            x="1"
            y="1"
            width="20"
            height="10"
            rx="2"
            fill="none"
            stroke={color}
            strokeWidth="1.4"
          />
        </svg>
      );
    case "dashedBox":
      return (
        <svg width="22" height="12" aria-hidden className="shrink-0">
          <rect
            x="1"
            y="1"
            width="20"
            height="10"
            rx="2"
            fill="none"
            stroke={color}
            strokeWidth="1.2"
            strokeDasharray="3 2"
          />
        </svg>
      );
    case "line":
      return (
        <svg width="22" height="12" aria-hidden className="shrink-0">
          <line x1="1" y1="6" x2="17" y2="6" stroke={color} strokeWidth="1.6" />
          <circle cx="19" cy="6" r="2.2" fill={color} />
        </svg>
      );
    case "dashedLine":
      return (
        <svg width="22" height="12" aria-hidden className="shrink-0">
          <line
            x1="1"
            y1="6"
            x2="17"
            y2="6"
            stroke={color}
            strokeWidth="1.4"
            strokeDasharray="3 2"
          />
          <circle cx="19" cy="6" r="2.2" fill={color} />
        </svg>
      );
    case "dot":
      return (
        <svg width="22" height="12" aria-hidden className="shrink-0">
          <circle cx="11" cy="6" r="3.4" fill={color} />
        </svg>
      );
    case "band":
      return (
        <svg width="22" height="12" aria-hidden className="shrink-0">
          <rect
            x="1"
            y="1"
            width="20"
            height="10"
            rx="2"
            fill={color}
            fillOpacity="0.18"
            stroke={color}
            strokeWidth="1"
            strokeDasharray="3 2"
          />
        </svg>
      );
    case "text":
      return (
        <svg width="22" height="12" aria-hidden className="shrink-0">
          <text
            x="11"
            y="9"
            fontSize="9"
            textAnchor="middle"
            fill={color}
            fontFamily="monospace"
            fontWeight="700"
          >
            Ab
          </text>
        </svg>
      );
  }
}

export function DiagramLegend({
  items,
  className,
}: {
  items: readonly LegendItem[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-muted/30 mt-3 rounded-lg border px-3 py-2.5",
        className,
      )}
    >
      <div className="text-muted-foreground mb-1.5 font-mono text-[9.5px] font-semibold tracking-widest uppercase">
        Key — what the shapes mean
      </div>
      <ul className="grid gap-x-5 gap-y-1.5 sm:grid-cols-2">
        {items.map((it) => (
          <li key={it.label} className="flex items-start gap-2">
            <span className="mt-0.5">
              <Swatch kind={it.kind} color={it.color ?? TONE.neutral} />
            </span>
            <span className="text-[11.5px] leading-snug">
              <span className="font-semibold">{it.label}</span>
              <span className="text-muted-foreground"> — {it.means}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Keys for each diagram in the walkthrough.
 * ------------------------------------------------------------------ */
export const LEGENDS = {
  sequence: [
    {
      kind: "box",
      color: TONE.neutral,
      label: "vertical line",
      means: "one participant, with time running downward",
    },
    {
      kind: "line",
      color: TONE.accent,
      label: "solid arrow",
      means: "a call — someone asking for something",
    },
    {
      kind: "dashedLine",
      color: TONE.neutral,
      label: "dashed arrow",
      means: "a return — the answer coming back",
    },
    {
      kind: "band",
      color: TONE.warn,
      label: "shaded band",
      means: "nobody is connected during this stretch",
    },
  ],
  er: [
    {
      kind: "box",
      color: TONE.neutral,
      label: "box",
      means: "a database table",
    },
    {
      kind: "text",
      color: TONE.neutral,
      label: "list inside",
      means: "the columns that table stores",
    },
    {
      kind: "line",
      color: TONE.neutral,
      label: "line + 1:N",
      means: "a relationship — one User has many Songs",
    },
    {
      kind: "text",
      color: TONE.accent,
      label: "orange column",
      means: "highlighted by the selector above",
    },
  ],
  stateMachine: [
    {
      kind: "box",
      color: TONE.neutral,
      label: "box",
      means: "a value the status column can hold",
    },
    {
      kind: "line",
      color: TONE.accent,
      label: "arrow",
      means: "a transition the code can perform",
    },
    {
      kind: "dot",
      color: TONE.accent,
      label: "moving dot",
      means: "the transition you have selected",
    },
    {
      kind: "box",
      color: TONE.accent,
      label: "highlighted",
      means: "the two states this transition connects",
    },
  ],
  dualWrite: [
    {
      kind: "box",
      color: TONE.ok,
      label: "green box",
      means: "written and still referenced — fine",
    },
    {
      kind: "box",
      color: TONE.bad,
      label: "red box",
      means: "written but nothing points at it — orphaned",
    },
    {
      kind: "line",
      color: TONE.accent,
      label: "solid line",
      means: "a write that happened",
    },
    {
      kind: "dashedLine",
      color: TONE.neutral,
      label: "dashed line",
      means: "a write that never happened",
    },
  ],
  attackSurface: [
    {
      kind: "box",
      color: TONE.bad,
      label: "red box",
      means: "reachable by anyone on the internet",
    },
    {
      kind: "box",
      color: TONE.ok,
      label: "green box",
      means: "reachable only from server code",
    },
    {
      kind: "line",
      color: TONE.bad,
      label: "solid line",
      means: "a path that exists",
    },
    {
      kind: "dashedLine",
      color: TONE.neutral,
      label: "dashed line",
      means: "a path that has been cut",
    },
  ],
} satisfies Record<string, readonly LegendItem[]>;

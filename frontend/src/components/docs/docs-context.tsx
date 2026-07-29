"use client";

import * as React from "react";

/**
 * Cross-stage interactive state.
 *
 * The teaching controls are deliberately shared rather than local: choosing
 * "custom lyrics" in Act I must still be in effect when the cost stage in Act V
 * counts model invocations, because that continuity is the point being made.
 */
export type GenerationMode =
  | "description"
  | "custom-lyrics"
  | "described-lyrics";

export type FailurePoint = "inference" | "upload" | "after-db";

export interface DocsState {
  mode: GenerationMode;
  setMode: (m: GenerationMode) => void;
  instrumental: boolean;
  setInstrumental: (v: boolean) => void;
  failure: FailurePoint;
  setFailure: (f: FailurePoint) => void;
  cold: boolean;
  setCold: (v: boolean) => void;
}

const DocsContext = React.createContext<DocsState | null>(null);

export function DocsProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = React.useState<GenerationMode>("description");
  const [instrumental, setInstrumental] = React.useState(false);
  const [failure, setFailure] = React.useState<FailurePoint>("inference");
  const [cold, setCold] = React.useState(true);

  const value = React.useMemo<DocsState>(
    () => ({
      mode,
      setMode,
      instrumental,
      setInstrumental,
      failure,
      setFailure,
      cold,
      setCold,
    }),
    [mode, instrumental, failure, cold],
  );

  return <DocsContext.Provider value={value}>{children}</DocsContext.Provider>;
}

export function useDocs(): DocsState {
  const ctx = React.useContext(DocsContext);
  if (!ctx) throw new Error("useDocs must be used inside <DocsProvider>");
  return ctx;
}

/* ------------------------------------------------------------------ *
 * Generation modes — derived from which Song columns the UI populates.
 * There is no `mode` column; prepare-request reconstructs it by testing
 * nullability in a fixed branch order (functions.ts:111).
 * ------------------------------------------------------------------ */
export interface ModeSpec {
  key: GenerationMode;
  ui: string;
  fields: readonly string[];
  endpoint: string;
  pyFn: string;
  qwen: readonly string[];
}

export const MODES: Record<GenerationMode, ModeSpec> = {
  description: {
    key: "description",
    ui: "Simple tab",
    fields: ["fullDescribedSong"],
    endpoint: "GENERATE_FROM_DESCRIPTION",
    pyFn: "generate_from_description",
    qwen: ["generate_prompt", "generate_lyrics", "generate_categories"],
  },
  "custom-lyrics": {
    key: "custom-lyrics",
    ui: "Custom tab + Write",
    fields: ["prompt", "lyrics"],
    endpoint: "GENERATE_WITH_LYRICS",
    pyFn: "generate_with_lyrics",
    qwen: ["generate_categories"],
  },
  "described-lyrics": {
    key: "described-lyrics",
    ui: "Custom tab + Auto",
    fields: ["prompt", "describedLyrics"],
    endpoint: "GENERATE_FROM_DESCRIBED_LYRICS",
    pyFn: "generate_with_described_lyrics",
    qwen: ["generate_lyrics", "generate_categories"],
  },
};

export const MODE_OPTIONS = [
  { value: "description" as const, label: "from description" },
  { value: "custom-lyrics" as const, label: "custom lyrics" },
  { value: "described-lyrics" as const, label: "described lyrics" },
];

export const ALL_MODE_FIELDS = [
  "fullDescribedSong",
  "prompt",
  "lyrics",
  "describedLyrics",
] as const;

/** Qwen calls actually made, given the mode and the instrumental switch. */
export function qwenCalls(mode: GenerationMode, instrumental: boolean) {
  return MODES[mode].qwen.filter(
    (q) => !(q === "generate_lyrics" && instrumental),
  );
}

/* ------------------------------------------------------------------ *
 * Failure taxonomy
 * ------------------------------------------------------------------ */
export interface FailureSpec {
  label: string;
  kind: "expected" | "terminal";
  refunded: boolean;
  status: string;
  orphan: boolean;
  blast: string;
  detect: string;
  path: readonly string[];
}

export const FAILURES: Record<FailurePoint, FailureSpec> = {
  inference: {
    label: "Modal returns non-OK",
    kind: "expected",
    refunded: true,
    status: "failed",
    orphan: false,
    blast: "one song",
    detect: "inline — response.ok is false",
    path: [
      "prepare ✓",
      "reserve ✓",
      "processing ✓",
      "step.fetch ✗",
      "refund-credit",
      "set-status-failed",
    ],
  },
  upload: {
    label: "container throws mid-upload",
    kind: "expected",
    refunded: true,
    status: "failed",
    orphan: true,
    blast: "one song + orphaned bytes",
    detect: "inline — surfaces as 5xx",
    path: [
      "prepare ✓",
      "reserve ✓",
      "processing ✓",
      "upload (A) ✓",
      "categories ✗",
      "step.fetch ✗",
      "refund-credit",
      "set-status-failed",
    ],
  },
  "after-db": {
    label: "run dies after the DB write",
    kind: "terminal",
    refunded: true,
    status: "processed",
    orphan: false,
    blast: "a free song",
    detect: "not detected — looks like success",
    path: [
      "prepare ✓",
      "reserve ✓",
      "processing ✓",
      "step.fetch ✓",
      "update-song-result ✓",
      "run marked failed → onFailure",
      "refund fires anyway",
      'updateMany status not "processed" → 0 rows',
    ],
  },
};

export const FAILURE_OPTIONS = (Object.keys(FAILURES) as FailurePoint[]).map(
  (k) => ({ value: k, label: FAILURES[k].label }),
);

"use client";

import * as React from "react";
import {
  AnimatePresence,
  LayoutGroup,
  animate,
  motion,
  useMotionValue,
  useTransform,
} from "framer-motion";

import { cn } from "~/lib/utils";
import { CODE } from "./code";
import {
  ALL_MODE_FIELDS,
  FAILURES,
  FAILURE_OPTIONS,
  MODES,
  MODE_OPTIONS,
  qwenCalls,
  useDocs,
} from "./docs-context";
import {
  AttackSurfaceDiagram,
  DetailedArchitectureDiagram,
  DualWriteDiagram,
  ER_LENSES,
  ErDiagram,
  SM_EDGES,
  SequenceDiagram,
  StateMachineDiagram,
  type ErLens,
} from "./diagrams";
import { DiagramLegend, LEGENDS } from "./legend";
import {
  Caption,
  Chip,
  CodeBlock,
  Eyebrow,
  Panel,
  Segmented,
  Stagger,
  StaggerItem,
  TONE,
} from "./primitives";

/* ================================================================== *
 * ACT I
 * ================================================================== */

export function ConstraintMech() {
  const [linear, setLinear] = React.useState(true);
  const rows = linear
    ? [
        { n: "request", w: 0.6, c: TONE.info, t: "what a user will wait for" },
        {
          n: "inference",
          w: 100,
          c: TONE.accent,
          t: "180s of audio on one L40S",
        },
      ]
    : [
        { n: "request", w: 42, c: TONE.info, t: "what a user will wait for" },
        { n: "inference", w: 100, c: TONE.accent, t: "same bar, compressed" },
      ];
  const consequences = [
    "the work cannot happen in the request → a background job",
    "the job outlives the process → its state must be durable, not in memory",
    "the client gets no return value → a status field becomes the API",
    "the job can fail after the user is gone → failure handling is server-side",
    "the work costs real GPU money → pay before it runs, refund if it dies",
  ];
  return (
    <div>
      <Segmented
        label="axis"
        value={linear}
        onChange={setLinear}
        options={[
          { value: true, label: "linear (true ratio)" },
          { value: false, label: "compressed to fit" },
        ]}
      />
      <div className="mb-4 flex flex-col gap-2">
        {rows.map((r) => (
          <div
            key={r.n}
            className="grid grid-cols-[74px_1fr] items-center gap-2"
          >
            <span className="text-muted-foreground text-right font-mono text-[10px] font-semibold">
              {r.n}
            </span>
            <div className="bg-muted/60 relative h-7 overflow-hidden rounded-md border">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(r.w, 0.6)}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 26 }}
                className="absolute inset-y-0 left-0 grid place-items-center overflow-hidden rounded-md px-2 font-mono text-[10px] font-semibold whitespace-nowrap text-white"
                style={{ background: r.c }}
              >
                {r.w >= 12 ? r.t : ""}
              </motion.div>
            </div>
          </div>
        ))}
      </div>
      <Panel tone="info" title="the forcing function" className="mb-3">
        Generation is orders of magnitude longer than any request may block for.
        That one fact is a physical property of the model, not a preference.
      </Panel>
      <Stagger>
        {consequences.map((t, i) => (
          <StaggerItem key={t}>
            <div className="bg-muted/40 flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5">
              <Chip>{i + 1}</Chip>
              <span className="text-xs">{t}</span>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
      <Caption>
        The bars show a ratio, not a measurement: this repo pins no timing
        numbers, and none are invented here.
      </Caption>
    </div>
  );
}

/**
 * The opening stage: one detailed diagram, full width, no argument column.
 *
 * Everything on it is a real identifier from the repository — route paths,
 * exported server actions, Inngest step ids, Modal endpoint names, Prisma
 * models — so it doubles as a map for finding the code.
 */
export function ArchitectureMech() {
  return (
    <div className="h-full min-h-0">
      <DetailedArchitectureDiagram />
    </div>
  );
}

export function SequenceMech() {
  return (
    <div>
      <SequenceDiagram />
      <DiagramLegend items={LEGENDS.sequence} />
      <Caption>
        Time flows downward. Solid arrows are calls, dashed are returns. The
        shaded band is the interval in which no user is connected.
      </Caption>
    </div>
  );
}

export function DataModelMech() {
  const [lens, setLens] = React.useState<ErLens>("money");
  return (
    <div>
      <Segmented
        label="highlight"
        value={lens}
        onChange={(v) => setLens(v)}
        options={(Object.keys(ER_LENSES) as ErLens[]).map((k) => ({
          value: k,
          label: ER_LENSES[k].label,
        }))}
      />
      <ErDiagram lens={lens} />
      <DiagramLegend items={LEGENDS.er} />
      <AnimatePresence mode="wait">
        <motion.div
          key={lens}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="mt-3"
        >
          <Panel tone="accent">{ER_LENSES[lens].note}</Panel>
        </motion.div>
      </AnimatePresence>
      <Caption>
        Verification is omitted — it is written by the auth library and has no
        relation to the rest. Song carries one index, on s3Key.
      </Caption>
    </div>
  );
}

const BOUNDARIES = [
  {
    k: "process",
    t: "Synchronous → asynchronous",
    tone: TONE.info,
    d: "The server action returns before the work starts. Nothing downstream can report back to the caller.",
    cost: "The UI must poll. status becomes a public contract.",
  },
  {
    k: "consistency",
    t: "Postgres ↔ S3",
    tone: TONE.warn,
    d: "Two stores with no shared transaction. Object bytes commit in the Modal container; the row commits in the orchestrator.",
    cost: "A dual-write window. Orphaned objects are possible and nothing reconciles them.",
  },
  {
    k: "trust",
    t: "Public surface ↔ privileged action",
    tone: TONE.bad,
    d: 'Every export of a "use server" file is an unauthenticated POST endpoint. Presigned URLs are bearer capabilities.',
    cost: "Authorisation must be proven at each entry, not assumed from the caller.",
  },
  {
    k: "cost",
    t: "Cheap CPU ↔ expensive GPU",
    tone: TONE.accent,
    d: "Everything left of Modal is fractions of a cent. Modal is dedicated L40S seconds per song.",
    cost: "Admission control and refunds have to exist, or failure is billed to you.",
  },
] as const;

export function BoundariesMech() {
  const [sel, setSel] = React.useState<string>("process");
  return (
    <div>
      <Segmented
        label="boundary"
        value={sel}
        onChange={setSel}
        options={BOUNDARIES.map((b) => ({
          value: b.k,
          label: b.t.split(" ")[0]!,
        }))}
      />
      <LayoutGroup>
        <div className="flex flex-col gap-2">
          {BOUNDARIES.map((b) => (
            <motion.div key={b.k} layout>
              <Panel
                tone={b.k === sel ? "accent" : "none"}
                title={b.t}
                onClick={() => setSel(b.k)}
                className="border-l-[3px]"
              >
                {b.k === sel ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="overflow-hidden"
                  >
                    <div>{b.d}</div>
                    <div className="text-muted-foreground/80 mt-1.5">
                      <span className="font-mono text-[10px] font-semibold">
                        WHAT IT COSTS YOU —{" "}
                      </span>
                      {b.cost}
                    </div>
                  </motion.div>
                ) : null}
              </Panel>
            </motion.div>
          ))}
        </div>
      </LayoutGroup>
    </div>
  );
}

export function ContractMech() {
  const { mode, setMode } = useDocs();
  const m = MODES[mode];
  return (
    <div>
      <Segmented
        label="mode"
        value={mode}
        onChange={setMode}
        options={MODE_OPTIONS}
      />
      <Eyebrow>t = 0 — what the caller gets back</Eyebrow>
      <Panel tone="ok" title={'a Song row, status "queued"'} className="mb-3">
        No audio. No cost incurred. No guarantee it will ever succeed. The
        server action returns void.
      </Panel>
      <Eyebrow>
        the discriminator is implicit — which columns are non-null
      </Eyebrow>
      <Stagger className="gap-1.5">
        {ALL_MODE_FIELDS.map((f) => {
          const on = m.fields.includes(f);
          return (
            <StaggerItem key={f}>
              <div
                className={cn(
                  "flex items-center justify-between rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors",
                  on
                    ? "border-[color:var(--chart-1)] bg-[color:var(--chart-1)]/10"
                    : "bg-muted/30 opacity-45",
                )}
              >
                <span className="font-semibold">{f}</span>
                <span className="text-muted-foreground text-[10px]">
                  {on ? "set" : "null"}
                </span>
              </div>
            </StaggerItem>
          );
        })}
      </Stagger>
      <AnimatePresence mode="wait">
        <motion.div
          key={m.key}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="mt-3"
        >
          <Panel tone="accent" title={`env.${m.endpoint}`}>
            → {m.pyFn}() · chosen by if/else-if order in prepare-request
          </Panel>
        </motion.div>
      </AnimatePresence>
      <Caption>
        There is no mode column. The mode is reconstructed later by testing
        nullability in a fixed branch order.
      </Caption>
    </div>
  );
}

/* ================================================================== *
 * ACT II
 * ================================================================== */

const STEPS = [
  "prepare-request",
  "reserve-credit",
  "set-status-processing",
  "step.fetch → Modal",
  "update-song-result",
];

export function DurableMech() {
  const [crash, setCrash] = React.useState(3);
  const [attempt, setAttempt] = React.useState(1);
  return (
    <div>
      <Segmented
        label="dies at step"
        value={crash}
        onChange={(v) => {
          setCrash(v);
          setAttempt(1);
        }}
        options={STEPS.map((_, i) => ({ value: i, label: String(i + 1) }))}
      />
      <div className="bg-muted/50 mb-3 flex items-center gap-2 rounded-lg border px-2.5 py-2">
        <span className="text-muted-foreground mr-1 font-mono text-[10px] font-semibold tracking-widest uppercase">
          attempt
        </span>
        <button
          type="button"
          onClick={() => setAttempt((a) => Math.min(a + 1, 3))}
          className="bg-background hover:border-foreground/30 rounded-md border px-2.5 py-1 text-xs"
        >
          replay
        </button>
        <button
          type="button"
          onClick={() => setAttempt(1)}
          className="bg-background hover:border-foreground/30 rounded-md border px-2.5 py-1 text-xs"
        >
          reset
        </button>
        <span className="text-primary font-mono text-[11px] font-semibold">
          #{attempt}
        </span>
      </div>
      <LayoutGroup>
        <div className="flex flex-col gap-2">
          {STEPS.map((s, i) => {
            const replayed = attempt > 1 && i < crash;
            const state =
              i < crash
                ? replayed
                  ? "cached"
                  : "ran"
                : i === crash
                  ? "died"
                  : "unreached";
            const tone =
              state === "died"
                ? "bad"
                : state === "cached"
                  ? "info"
                  : state === "ran"
                    ? "ok"
                    : "none";
            return (
              <motion.div key={s} layout>
                <Panel tone={tone} dim={state === "unreached"}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-foreground font-mono text-[11px] font-semibold">
                      {i + 1}. {s}
                    </span>
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {state === "cached"
                        ? "replayed from store — body NOT re-executed"
                        : state === "ran"
                          ? "executed, result persisted"
                          : state === "died"
                            ? "throws → retried"
                            : "not reached"}
                    </span>
                  </div>
                </Panel>
              </motion.div>
            );
          })}
        </div>
      </LayoutGroup>
      <Caption>
        Illustrative of the replay model; not driving a real Inngest run. Retry
        counts and timeouts are library defaults — nothing in this repo
        configures them.
      </Caption>
    </div>
  );
}

export function LifecycleMech() {
  const [sel, setSel] = React.useState("t1");
  const e = SM_EDGES.find((x) => x.id === sel) ?? SM_EDGES[0]!;
  return (
    <div>
      <Segmented
        label="transition"
        value={sel}
        onChange={setSel}
        options={SM_EDGES.map((x) => ({ value: x.id, label: x.label }))}
      />
      <StateMachineDiagram selected={sel} />
      <DiagramLegend items={LEGENDS.stateMachine} />
      <AnimatePresence mode="wait">
        <motion.div
          key={sel}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="mb-3"
        >
          <Panel
            tone={e.guard.startsWith("GUARDED") ? "ok" : "none"}
            title={`${e.a} → ${e.b}`}
          >
            {e.guard}
            <div className="text-muted-foreground/70 mt-1">{e.src}</div>
          </Panel>
        </motion.div>
      </AnimatePresence>
      <CodeBlock caption="the reader does not enumerate the same set">
        {CODE.statusSwitch}
      </CodeBlock>
    </div>
  );
}

export function BackpressureMech() {
  const [jobs, setJobs] = React.useState(["a", "b", "c", "d", "e"]);
  const [running, setRunning] = React.useState<string | null>(null);
  React.useEffect(() => {
    const id = setInterval(() => {
      setJobs((prev) => {
        if (prev.length === 0) {
          setRunning(null);
          return ["a", "b", "c", "d", "e"];
        }
        setRunning(prev[0]!);
        return prev.slice(1);
      });
    }, 1600);
    return () => clearInterval(id);
  }, []);
  return (
    <div>
      <CodeBlock caption="functions.ts:37">{CODE.concurrency}</CodeBlock>
      <div className="mt-3">
        <Eyebrow>admitted — one slot per user</Eyebrow>
        <div className="mb-3 min-h-13">
          <AnimatePresence mode="popLayout">
            {running ? (
              <motion.div
                key={running}
                layout
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              >
                <Panel
                  tone="accent"
                  title={`job ${running} — holding the slot for minutes`}
                />
              </motion.div>
            ) : (
              <Panel key="idle" dim>
                idle
              </Panel>
            )}
          </AnimatePresence>
        </div>
        <Eyebrow>queued behind it — head-of-line blocked</Eyebrow>
        <div className="flex min-h-32 flex-col gap-2">
          <AnimatePresence mode="popLayout">
            {jobs.map((j) => (
              <motion.div
                key={j}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 26, transition: { duration: 0.22 } }}
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              >
                <Panel
                  title={`job ${j} — credit already reserved, still waiting`}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
      <Caption>
        Illustrative depth of 5. The real cap is exactly 1 concurrent run per
        user; the key partitions the limit so other users are unaffected.
      </Caption>
    </div>
  );
}

export function TaxonomyMech() {
  const { failure, setFailure } = useDocs();
  const f = FAILURES[failure];
  const rows: [string, string, string?][] = [
    [
      "class",
      f.kind === "expected"
        ? "expected — handled inline"
        : "terminal — onFailure",
    ],
    ["credit refunded", String(f.refunded)],
    ["final status", `"${f.status}"`],
    ["orphaned S3 objects", String(f.orphan)],
    ["blast radius", f.blast],
    ["detectability", f.detect],
  ];
  return (
    <div>
      <Segmented
        label="inject"
        value={failure}
        onChange={setFailure}
        options={FAILURE_OPTIONS}
      />
      <Stagger key={failure} className="gap-1.5">
        {f.path.map((s) => (
          <StaggerItem key={s}>
            <Panel
              tone={
                s.includes("✗")
                  ? "bad"
                  : s.includes("refund") || s.includes("updateMany")
                    ? "ok"
                    : "none"
              }
              title={s}
            />
          </StaggerItem>
        ))}
      </Stagger>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-xs">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <th className="bg-muted/60 text-muted-foreground border px-2 py-1.5 text-left font-mono text-[10px] font-semibold tracking-wider uppercase">
                  {k}
                </th>
                <td className="border px-2 py-1.5">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Caption>
        Two handlers, one invariant. Expected failure is a value; terminal
        failure is an exception path. Both funnel into the same idempotent
        refund.
      </Caption>
    </div>
  );
}

/* ================================================================== *
 * ACT III
 * ================================================================== */

export function ToctouMech() {
  const [t, setT] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setT((v) => (v + 1) % 4), 1500);
    return () => clearInterval(id);
  }, []);
  const steps = [
    {
      a: "read credits = 1",
      b: "read credits = 1",
      note: "both runs observe the same balance",
    },
    {
      a: "generate… (minutes)",
      b: "generate… (minutes)",
      note: "the check is now arbitrarily stale",
    },
    {
      a: "decrement → 0",
      b: "decrement → −1",
      note: "no predicate on the write",
    },
    {
      a: "done",
      b: "done",
      note: "one song was free and the balance is negative",
    },
  ];
  return (
    <div>
      <Eyebrow>two concurrent runs, one credit — analogy of the race</Eyebrow>
      <div className="grid grid-cols-2 gap-2">
        {["run 1", "run 2"].map((lane, li) => (
          <div key={lane} className="flex flex-col gap-2">
            <div className="text-muted-foreground font-mono text-[10px] font-semibold">
              {lane}
            </div>
            {steps.map((s, i) => (
              <motion.div key={i} animate={{ opacity: i > t ? 0.3 : 1 }}>
                <Panel
                  tone={
                    i === 3 && li === 1 ? "bad" : i === t ? "accent" : "none"
                  }
                  title={li === 0 ? s.a : s.b}
                />
              </motion.div>
            ))}
          </div>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.p
          key={t}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="text-muted-foreground mt-3 text-[11.5px] italic"
        >
          {steps[t]!.note}
        </motion.p>
      </AnimatePresence>
      <div className="mt-3">
        <CodeBlock caption="the code that produced it">{CODE.naive}</CodeBlock>
      </div>
    </div>
  );
}

export function ReserveMech() {
  const [phase, setPhase] = React.useState(0);
  const tokens = phase === 1 ? 3 : 4;
  return (
    <div>
      <Segmented
        label="protocol phase"
        value={phase}
        onChange={setPhase}
        options={[
          { value: 0, label: "1 · reserve" },
          { value: 1, label: "2a · settle (success)" },
          { value: 2, label: "2b · compensate (failure)" },
        ]}
      />
      <div className="mb-3 flex flex-wrap gap-5">
        <div>
          <Eyebrow>user.credits</Eyebrow>
          <div className="flex min-h-7 w-32 flex-wrap gap-1">
            <AnimatePresence>
              {Array.from({ length: tokens }, (_, i) => (
                <motion.div
                  key={i}
                  layout
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 30 }}
                  className="size-5 rounded"
                  style={{ background: TONE.ok }}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
        <div>
          <Eyebrow>song flags</Eyebrow>
          <Panel className="min-w-45">
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px]">
              <span className="text-muted-foreground">creditReserved</span>
              <span className="text-foreground">
                {phase === 0 ? "false → true" : "true"}
              </span>
              <span className="text-muted-foreground">creditRefunded</span>
              <span
                style={{ color: phase === 2 ? TONE.ok : undefined }}
                className={
                  phase === 2 ? "font-semibold" : "text-muted-foreground"
                }
              >
                {phase === 2 ? "true" : "false"}
              </span>
            </div>
          </Panel>
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="mb-3"
        >
          <Panel
            tone={phase === 2 ? "ok" : "info"}
            title={
              [
                "reserve — take the credit BEFORE the work",
                "settle — the song succeeded; the reservation simply stands",
                "compensate — give it back, exactly once",
              ][phase]
            }
          >
            {
              [
                "A conditional decrement plus the flag, one transaction. Either both land or neither does.",
                "There is no second write on success. The absence of a settle step is deliberate: fewer writes, fewer windows.",
                "refundCreditIfReserved increments and sets creditRefunded together, so replay is a no-op.",
              ][phase]
            }
          </Panel>
        </motion.div>
      </AnimatePresence>
      <CodeBlock caption="functions.ts:152">{CODE.reserve}</CodeBlock>
      <Caption>
        Illustrative balance of 4 (accounts start at 100 — schema.prisma:23).
        One song always costs exactly 1.
      </Caption>
    </div>
  );
}

export function IdempotentMech() {
  const [n, setN] = React.useState(0);
  return (
    <div>
      <CodeBlock caption="functions.ts:13">{CODE.refund}</CodeBlock>
      <div className="bg-muted/50 my-3 flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-2">
        <span className="text-muted-foreground mr-1 font-mono text-[10px] font-semibold tracking-widest uppercase">
          replay
        </span>
        <button
          type="button"
          onClick={() => setN((r) => Math.min(r + 1, 4))}
          className="bg-background hover:border-foreground/30 rounded-md border px-2.5 py-1 text-xs"
        >
          call refundCreditIfReserved()
        </button>
        <button
          type="button"
          onClick={() => setN(0)}
          className="bg-background hover:border-foreground/30 rounded-md border px-2.5 py-1 text-xs"
        >
          reset
        </button>
      </div>
      <LayoutGroup>
        <div className="flex min-h-22 flex-col gap-2">
          <AnimatePresence>
            {Array.from({ length: n }, (_, i) => (
              <motion.div
                key={i}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              >
                <Panel
                  tone={i === 0 ? "ok" : "none"}
                  dim={i > 0}
                  title={`call ${i + 1} → ${i === 0 ? "true — credit returned" : "false — zero writes"}`}
                >
                  {i === 0
                    ? "reserved && !refunded → increment + flag, one transaction"
                    : "creditRefunded is already true → the guard short-circuits before any write"}
                </Panel>
              </motion.div>
            ))}
          </AnimatePresence>
          {n === 0 ? <Panel dim>not yet called</Panel> : null}
        </div>
      </LayoutGroup>
      <Caption>
        The predicate reads the same row the flag is written to, inside the
        transaction that writes it. There is no interval in which a second
        caller can observe &quot;refundable&quot; after the first commits.
      </Caption>
    </div>
  );
}

export function DualWriteMech() {
  const { failure, setFailure } = useDocs();
  const f = FAILURES[failure];
  return (
    <div>
      <Segmented
        label="inject"
        value={failure}
        onChange={setFailure}
        options={FAILURE_OPTIONS}
      />
      <DualWriteDiagram
        orphan={f.orphan}
        rowWritten={f.status === "processed"}
      />
      <DiagramLegend items={LEGENDS.dualWrite} />
      <AnimatePresence mode="wait">
        <motion.div
          key={failure}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="my-3"
        >
          <Panel
            tone={f.orphan ? "bad" : "ok"}
            title={f.orphan ? "orphan window open" : "no orphan in this path"}
          >
            {f.orphan
              ? "The wav is already in S3 when the call fails. The user is correctly refunded and the row is marked failed — but nothing references those bytes and nothing deletes them."
              : "Either the bytes were never written, or the row that references them committed."}
          </Panel>
        </motion.div>
      </AnimatePresence>
      <CodeBlock caption="the two writes live in different processes">
        {CODE.dualWrite}
      </CodeBlock>
    </div>
  );
}

export function WebhookMech() {
  const [deliveries, setDeliveries] = React.useState(1);
  return (
    <div>
      <CodeBlock caption="lib/auth.ts:44">{CODE.webhook}</CodeBlock>
      <div className="bg-muted/50 my-3 flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-2">
        <span className="text-muted-foreground mr-1 font-mono text-[10px] font-semibold tracking-widest uppercase">
          provider redelivers
        </span>
        <button
          type="button"
          onClick={() => setDeliveries((d) => Math.min(d + 1, 3))}
          className="bg-background hover:border-foreground/30 rounded-md border px-2.5 py-1 text-xs"
        >
          deliver again
        </button>
        <button
          type="button"
          onClick={() => setDeliveries(1)}
          className="bg-background hover:border-foreground/30 rounded-md border px-2.5 py-1 text-xs"
        >
          reset
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: deliveries }, (_, i) => (
          <motion.div
            key={i}
            layout
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Panel
              tone={i === 0 ? "ok" : "bad"}
              title={`delivery ${i + 1} → credits += 10`}
            >
              {i === 0
                ? "correct — the order was paid"
                : "duplicate grant. The increment is not keyed by order id, so nothing rejects it."}
            </Panel>
          </motion.div>
        ))}
      </div>
      <motion.div layout className="mt-2">
        <Panel
          tone="info"
          title={`balance granted: ${deliveries * 10} for one order paid`}
        >
          The reservation path carries an explicit flag to survive replay. The
          money-in path has no equivalent.
        </Panel>
      </motion.div>
    </div>
  );
}

/* ================================================================== *
 * ACT IV
 * ================================================================== */

export function EndpointsMech() {
  const [before, setBefore] = React.useState(true);
  return (
    <div>
      <Segmented
        label="commit e858b46"
        value={before}
        onChange={setBefore}
        options={[
          { value: true, label: "before" },
          { value: false, label: "after" },
        ]}
      />
      <AttackSurfaceDiagram before={before} />
      <DiagramLegend items={LEGENDS.attackSurface} />
      <AnimatePresence mode="wait">
        <motion.div
          key={String(before)}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="mt-3"
        >
          <Panel
            tone={before ? "bad" : "ok"}
            title={
              before
                ? "the mental model that fails"
                : "the fix — move it out of the surface"
            }
          >
            {before
              ? 'It is just a helper in an actions file is not a thing the framework knows. Export it from a "use server" module and it is a public route with an argument the caller controls.'
              : 'import "server-only" makes reachability a build error rather than a review question. The signer stays dumb; callers prove the right to the key.'}
          </Panel>
        </motion.div>
      </AnimatePresence>
      <Caption>
        Verbatim from the commit: moved out &quot;so it is no longer exposed as
        a public unauthenticated server action that signs arbitrary S3
        keys&quot;.
      </Caption>
    </div>
  );
}

export function CapabilityMech() {
  const p = useMotionValue(0);
  React.useEffect(() => {
    p.set(0);
    const c = animate(p, 1, { duration: 5, ease: "linear", repeat: Infinity });
    return () => c.stop();
  }, [p]);
  const width = useTransform(p, (v) => `${(1 - v) * 100}%`);
  const background = useTransform(p, (v) =>
    v > 0.8 ? TONE.bad : v > 0.5 ? TONE.warn : TONE.ok,
  );
  return (
    <div>
      <CodeBlock caption="lib/s3.ts + its caller">{CODE.presign}</CodeBlock>
      <div className="mt-3">
        <Eyebrow>the capability, as issued</Eyebrow>
        <Panel>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px]">
            <span className="text-muted-foreground">grants</span>
            <span className="text-foreground">GET on exactly one key</span>
            <span className="text-muted-foreground">proves</span>
            <span className="text-foreground">
              nothing about who is holding it
            </span>
            <span className="text-muted-foreground">expires</span>
            <span className="text-foreground">3600s after issue</span>
            <span className="text-muted-foreground">revocable</span>
            <span style={{ color: TONE.bad }} className="font-semibold">
              no
            </span>
          </div>
          <div className="mt-2.5">
            <div className="bg-muted relative h-2.5 overflow-hidden rounded border">
              <motion.div
                className="absolute inset-y-0 left-0 rounded"
                style={{ width, background }}
              />
            </div>
            <div className="text-muted-foreground mt-1 font-mono text-[10px]">
              TTL burning down — the only thing that ever takes the capability
              away
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ================================================================== *
 * ACT V
 * ================================================================== */

function ColdWarmLanes({ cold }: { cold: boolean }) {
  const segs = cold
    ? [
        { n: "schedule", w: 6, c: TONE.neutral },
        { n: "pull image", w: 20, c: TONE.warn },
        { n: "@modal.enter — load 3 models", w: 40, c: TONE.bad },
        { n: "inference", w: 34, c: TONE.accent },
      ]
    : [
        { n: "route to live container", w: 4, c: TONE.neutral },
        { n: "inference", w: 96, c: TONE.accent },
      ];
  let acc = 0;
  return (
    <div className="flex flex-col gap-2">
      {segs.map((s) => {
        const left = acc;
        acc += s.w;
        return (
          <div
            key={s.n}
            className="grid grid-cols-[54px_1fr] items-center gap-2"
          >
            <span className="text-muted-foreground text-right font-mono text-[10px] font-semibold">
              {s.w}%
            </span>
            <div className="bg-muted/60 relative h-5.5 overflow-hidden rounded-md border">
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: `${s.w}%`, opacity: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 190,
                  damping: 28,
                  delay: left / 160,
                }}
                className="absolute inset-y-0 grid place-items-center overflow-hidden rounded px-1.5 font-mono text-[9.5px] font-semibold whitespace-nowrap text-white"
                style={{ left: `${left}%`, background: s.c }}
              >
                {s.n}
              </motion.div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CostMech() {
  const { mode, setMode, instrumental, setInstrumental, cold, setCold } =
    useDocs();
  const calls = qwenCalls(mode, instrumental);
  return (
    <div>
      <Segmented
        label="container"
        value={cold}
        onChange={setCold}
        options={[
          { value: true, label: "cold" },
          { value: false, label: "warm" },
        ]}
      />
      <ColdWarmLanes key={String(cold)} cold={cold} />
      <div className="mt-3">
        <Segmented
          label="mode"
          value={mode}
          onChange={setMode}
          options={MODE_OPTIONS}
        />
        <Segmented
          label="instrumental"
          value={instrumental}
          onChange={setInstrumental}
          options={[
            { value: false, label: "false" },
            { value: true, label: "true" },
          ]}
        />
      </div>
      <motion.div layout>
        <Panel
          title={`models invoked on this one L40S: ${1 + calls.length + 1}`}
        >
          ACE-Step ×1 · Qwen ×{calls.length} ({calls.join(", ")}) · SDXL-Turbo
          ×1
          <div className="text-muted-foreground/80 mt-1.5">
            Billed the same 1 credit regardless — and regardless of duration,
            which is fixed at 180s.
          </div>
        </Panel>
      </motion.div>
      <Caption>
        Charging is flat while cost is not: an instrumental custom-lyrics song
        runs one LLM call, a from-description song runs three, and a cold
        container pays for three model loads first.
      </Caption>
    </div>
  );
}

const SCALE = {
  "1": {
    label: "1×",
    first: "nothing saturates",
    detail:
      "A handful of songs a day. Cold starts dominate latency because scaledown_window=10 means containers almost never survive between requests.",
    rows: [
      ["GPU", "idle most of the time", "—"],
      ["Postgres", "trivial", "—"],
      ["presign", "a few per page", "—"],
      ["cost", "dominated by cold starts", "⚠"],
    ],
  },
  "10": {
    label: "10×",
    first: "cold-start amortisation flips",
    detail:
      "Traffic becomes dense enough that containers stay warm, so unit latency drops sharply. The per-user cap of 1 starts being felt by power users.",
    rows: [
      ["GPU", "warm, well utilised", "✓"],
      ["Postgres", "fine", "—"],
      ["presign", "N per track-list render", "⚠"],
      ["cost", "dominated by inference", "✓"],
    ],
  },
  "100": {
    label: "100×",
    first: "the track list and the queue",
    detail:
      "Every /create render signs a URL per song; the home feed signs up to 100 per load. Meanwhile limit:1 per user becomes visible head-of-line blocking, and each queued job holds a reserved credit while it waits.",
    rows: [
      ["GPU", "capacity-bound, needs quota", "⚠"],
      ["Postgres", "reads indexed on s3Key only", "⚠"],
      ["presign", "O(songs) per render — breaks first", "✗"],
      ["cost", "needs per-duration pricing", "✗"],
    ],
  },
} as const;

type ScaleKey = keyof typeof SCALE;

export function ScaleMech() {
  const [s, setS] = React.useState<ScaleKey>("1");
  const d = SCALE[s];
  return (
    <div>
      <Segmented
        label="traffic"
        value={s}
        onChange={(v) => setS(v)}
        options={(Object.keys(SCALE) as ScaleKey[]).map((k) => ({
          value: k,
          label: SCALE[k].label,
        }))}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={s}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <Panel
            tone="accent"
            title={`first thing to saturate: ${d.first}`}
            className="mb-3"
          >
            {d.detail}
          </Panel>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-xs">
              <thead>
                <tr>
                  {["component", "state", ""].map((h) => (
                    <th
                      key={h}
                      className="bg-muted/60 text-muted-foreground border px-2 py-1.5 text-left font-mono text-[10px] font-semibold tracking-wider uppercase"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r[0]}>
                    <td className="border px-2 py-1.5 font-mono">{r[0]}</td>
                    <td className="border px-2 py-1.5">{r[1]}</td>
                    <td
                      className="border px-2 py-1.5 font-mono font-semibold"
                      style={{
                        color:
                          r[2] === "✗"
                            ? TONE.bad
                            : r[2] === "⚠"
                              ? TONE.warn
                              : TONE.ok,
                      }}
                    >
                      {r[2]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </AnimatePresence>
      <Caption>
        Scale tiers are reasoning about the code&apos;s shape, not load-test
        results — no benchmarks exist in this repo.
      </Caption>
    </div>
  );
}

const REFACTORS = [
  {
    p: "1",
    t: "Idempotency key on the webhook",
    why: "Money-in is the only unprotected replay path. Store the Polar order id and make the grant conditional on inserting it.",
    cost: "one table, one unique constraint",
  },
  {
    p: "2",
    t: "Status as an enum + a reconciler",
    why: 'Free-text status is written in one file and switch-ed in another with no shared type; the reader has no "processed" case and treats unknown values as playable.',
    cost: "a migration and a type",
  },
  {
    p: "3",
    t: "Outbox or a sweeper for S3",
    why: "Closes the dual-write orphan window. Either write the key before the bytes and sweep unreferenced objects, or record intent first.",
    cost: "a background job",
  },
  {
    p: "4",
    t: "Unify the refund and status guards",
    why: "They key on different columns, so a run that dies after update-song-result refunds a song the user can still play.",
    cost: "one predicate",
  },
  {
    p: "5",
    t: "Push instead of Refresh",
    why: "The finished state exists in the DB minutes before the user sees it. The job already knows when it is done.",
    cost: "a channel, or polling with backoff",
  },
  {
    p: "6",
    t: "Persist the seed",
    why: 'seed is always −1, so nothing is reproducible and "give me another like this" is unbuildable.',
    cost: "write back the resolved seed",
  },
];

export function RefactorMech() {
  return (
    <Stagger>
      {REFACTORS.map((r) => (
        <StaggerItem key={r.p}>
          <div className="bg-muted/40 flex gap-3 rounded-lg border px-3 py-2">
            <Chip tone="accent" className="h-fit">
              {r.p}
            </Chip>
            <div>
              <div className="text-[13px] font-semibold">{r.t}</div>
              <div className="text-muted-foreground mt-0.5 text-xs leading-snug">
                {r.why}
              </div>
              <div className="text-muted-foreground/70 mt-1 font-mono text-[11px]">
                cost: {r.cost}
              </div>
            </div>
          </div>
        </StaggerItem>
      ))}
    </Stagger>
  );
}

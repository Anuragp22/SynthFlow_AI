"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "~/lib/utils";
import { TONE } from "./primitives";
import { useStageNav } from "./stage-link";

/**
 * SVG diagram primitives.
 *
 * Two rules learned the hard way and encoded here:
 *
 * 1. SVG shapes stay PLAIN elements. framer-motion drops hyphenated
 *    presentation attributes on `motion.*` SVG elements, which silently falls
 *    back to the SVG defaults (1px strokes, 16px text). Colour and opacity
 *    transitions come from the CSS class below instead.
 * 2. SVG text neither wraps nor clips, so every box is sized to its longest
 *    label. Changing a label means re-checking the width.
 */
const SHAPE_TRANSITION =
  "[transition:fill_250ms_ease,stroke_250ms_ease,opacity_250ms_ease]";

export function Diagram({
  viewBox,
  label,
  children,
  className,
  fit,
}: {
  viewBox: string;
  label: string;
  children: React.ReactNode;
  className?: string;
  /**
   * Scale to fill the parent box in BOTH axes rather than taking full width and
   * whatever height that implies. Needed for the big architecture map: at full
   * width its natural height overflows the fixed-viewport shell, and this
   * document does not scroll.
   */
  fit?: boolean;
}) {
  return (
    <svg
      viewBox={viewBox}
      role="img"
      aria-label={label}
      preserveAspectRatio="xMidYMid meet"
      className={cn(
        "block font-mono",
        fit ? "h-full w-full" : "h-auto w-full overflow-visible",
        className,
      )}
    >
      {children}
    </svg>
  );
}

const boxClass = `${SHAPE_TRANSITION}`;

/* ================================================================== *
 * 1. Detailed architecture diagram
 *
 * Full-bleed C4-container-level view. Every label is a real identifier from
 * this repository — route paths, exported server actions, Inngest step ids,
 * Modal endpoint names, Prisma models. Nothing here is illustrative.
 * ================================================================== */

/**
 * Hover state for the map's clickable regions.
 *
 * The tooltip is HTML rather than SVG `<title>`: the native one is slow to
 * appear, unstyleable, and shows raw text with no room for a hint about what
 * clicking does. The hotspot only reports what is hovered and where; the
 * diagram positions and renders the card.
 */
interface HotspotHover {
  title: string;
  to: string;
  x: number;
  y: number;
}

const HoverContext = React.createContext<
  ((h: HotspotHover | null) => void) | null
>(null);

/**
 * A clickable region of the map.
 *
 * Every band on the diagram is covered in depth by exactly one later stage, so
 * the band is a link to it. That is the alternative to restating the same
 * detail here: the map stays a map, and the depth lives where it belongs.
 */
function Hotspot({
  x,
  y,
  w,
  h,
  to,
  title,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  to?: string;
  title: string;
}) {
  const nav = useStageNav();
  const setHover = React.useContext(HoverContext);
  if (!nav || !to) return null;
  // Clamp here rather than at render time: this runs in an event handler, so
  // the viewport is safe to measure and the renderer stays a pure function of
  // state — no layout reads, no refs.
  const report = (e: React.MouseEvent) =>
    setHover?.({
      title,
      to,
      x: Math.max(8, Math.min(e.clientX + 16, window.innerWidth - 240)),
      y: Math.max(8, e.clientY - 58),
    });
  return (
    <g
      className="cursor-pointer"
      role="link"
      aria-label={`${title} — open ${nav.labelOf(to) ?? "the stage that covers this"}`}
      onClick={() => nav.go(to)}
      onMouseEnter={report}
      onMouseMove={report}
      onMouseLeave={() => setHover?.(null)}
    >
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={2.5}
        fill="transparent"
        stroke="none"
      />
    </g>
  );
}

/** A titled band. Bands are the four places code runs, plus the stores. */
function Band({
  x,
  y,
  w,
  h,
  title,
  sub,
  tone,
  to,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string;
  tone: string;
  /** Stage that covers this band in depth; makes the band clickable. */
  to?: string;
}) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={2.5}
        fill={TONE.raised}
        fillOpacity={0.5}
        stroke={tone}
        strokeWidth={0.45}
      />
      <text x={x + 3} y={y + 5.2} fontSize={3.1} fontWeight={700} fill={tone}>
        {title}
      </text>
      {to ? (
        // Monospace, so the title's width is predictable: ~0.6em per character.
        <text
          x={x + 3 + title.length * 3.1 * 0.6 + 1.4}
          y={y + 5.2}
          fontSize={3.1}
          fontWeight={700}
          fill={tone}
          opacity={0.55}
        >
          ›
        </text>
      ) : null}
      {sub ? (
        <text
          x={x + w - 3}
          y={y + 5.2}
          fontSize={2.2}
          textAnchor="end"
          fill={TONE.neutral}
        >
          {sub}
        </text>
      ) : null}
      {/* Only the title strip is clickable. The rest of the band is covered by
          leaf boxes, which sit above it in paint order and would swallow the
          click before it ever reached a full-height hotspot. */}
      <Hotspot x={x} y={y} w={w} h={6.8} to={to} title={title} />
    </>
  );
}

/** A leaf box with a heading and a stack of monospace lines. */
function Node({
  x,
  y,
  w,
  h,
  head,
  lines,
  tone,
  headTone,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  head?: string;
  lines: readonly string[];
  tone: string;
  headTone?: string;
}) {
  const top = y + (head ? 8.2 : 4.6);
  return (
    <>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={1.8}
        fill="var(--card)"
        stroke={tone}
        strokeWidth={0.35}
      />
      {head ? (
        <text
          x={x + 2.2}
          y={y + 4.6}
          fontSize={2.5}
          fontWeight={700}
          fill={headTone ?? TONE.ink}
        >
          {head}
        </text>
      ) : null}
      {lines.map((l, i) => (
        <text
          key={l + i}
          x={x + 2.2}
          y={top + i * 3.5}
          fontSize={2.15}
          fill={l.startsWith("·") ? TONE.neutral : TONE.ink}
        >
          {l}
        </text>
      ))}
    </>
  );
}

/**
 * The five hops of the write path, in execution order.
 *
 * `title` and `body` are written for someone who has never seen the repo;
 * `code` is the identifier to grep for once they want the actual source.
 */
const ARCH_EDGES = [
  {
    id: "a1",
    from: [96, 25.5] as const,
    to: [96, 30] as const,
    title: "You press Create",
    body: 'The browser calls a function that runs on the server. It saves one row in the database marked "queued", fires off an event, and returns nothing at all — no song, not even an id to ask about later.',
    code: "generateSong() → queueSong() · src/actions/generation.ts",
  },
  {
    id: "a2",
    from: [96, 66] as const,
    to: [96, 70] as const,
    title: "The work is handed to something that outlives the request",
    body: "Your page has already finished loading by this point. The event goes to Inngest, which now owns the job — if a server dies mid-way, Inngest is what starts it again.",
    code: 'inngest.send({ name: "generate-song-event" })',
  },
  {
    id: "a3",
    from: [96, 98] as const,
    to: [96, 102] as const,
    title: "One credit is taken, then the GPU is called",
    body: "The credit is charged before the work, not after, because nobody is connected to complain if it fails. Then a GPU machine is woken up and asked to make the song. This is the slow part — minutes, not seconds.",
    code: "reserve-credit → step.fetch(endpoint) · requires_proxy_auth",
  },
  {
    id: "a4",
    from: [189, 118] as const,
    to: [196, 104] as const,
    title: "The GPU saves the files itself",
    body: "The container writes the audio and the cover image straight to S3 and sends back only their filenames. Nothing else ever holds the bytes — which means if the next step fails, no one can take these files back.",
    code: "boto3 upload_file · backend/main.py",
  },
  {
    id: "a5",
    from: [189, 84] as const,
    to: [196, 60] as const,
    title: "The row is updated — only now does the song exist",
    body: 'The database finally learns where the files are and flips the status to "processed". Before this write lands the files are already sitting in S3, but nothing points at them and no page will show them.',
    code: "update-song-result · prisma.song.update",
  },
] as const;

/** The hover card shown over a clickable band. */
function HotspotTooltip({ hover }: { hover: HotspotHover }) {
  const nav = useStageNav();
  const label = nav?.labelOf(hover.to);
  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.13, ease: [0.22, 1, 0.36, 1] }}
      style={{ left: hover.x, top: hover.y }}
      className="bg-popover text-popover-foreground pointer-events-none fixed z-50 w-56 rounded-lg border px-3 py-2 shadow-lg"
    >
      <div className="truncate font-mono text-[11px] font-semibold">
        {hover.title}
      </div>
      {label ? (
        <div className="text-muted-foreground mt-1 text-[11.5px] leading-snug">
          Click to open{" "}
          <span className="text-primary font-semibold">{label}</span> — the
          stage that covers this.
        </div>
      ) : null}
    </motion.div>
  );
}

/**
 * The architecture map, with its narration and its key.
 *
 * One unstyled row above the map: step buttons and the active step's
 * description. No panel band, no collapse control, no key — the diagram labels
 * every box in words, so a shape key was decoration with a vertical cost.
 */
export function DetailedArchitectureDiagram() {
  const [hover, setHover] = React.useState<HotspotHover | null>(null);
  const [i, setI] = React.useState(0);
  // Auto-advance until the reader takes over, then stay where they put it —
  // the descriptions are long enough that a moving target is annoying.
  const [manual, setManual] = React.useState(false);
  React.useEffect(() => {
    if (manual) return;
    const id = setInterval(
      () => setI((v) => (v + 1) % ARCH_EDGES.length),
      4200,
    );
    return () => clearInterval(id);
  }, [manual]);
  const active = ARCH_EDGES[i]!;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* Steps and the active description sit on ONE unstyled row. Every pixel
          of chrome here is a pixel the map does not get. */}
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-muted-foreground hidden shrink-0 font-mono text-[10px] font-semibold tracking-widest uppercase lg:inline">
          how a song gets made
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          {ARCH_EDGES.map((e, n) => (
            <button
              key={e.id}
              type="button"
              // The long explanation lives here rather than on the page: it
              // stays available on hover without costing vertical space.
              title={`${n + 1}. ${e.title}\n\n${e.body}`}
              aria-label={`Step ${n + 1}: ${e.title}. ${e.body}`}
              aria-pressed={n === i}
              onClick={() => {
                setManual(true);
                setI(n);
              }}
              className={cn(
                "size-5 shrink-0 rounded-md border font-mono text-[10px] transition-colors",
                n === i
                  ? "bg-primary text-primary-foreground border-transparent font-semibold"
                  : "bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground",
              )}
            >
              {n + 1}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="min-w-0 flex-1"
          >
            <div className="truncate text-[13px] leading-tight font-semibold">
              {active.title}
            </div>
            <div className="text-muted-foreground/80 truncate font-mono text-[10.5px]">
              {active.code}
            </div>
          </motion.div>
        </AnimatePresence>
        <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
          {manual ? "paused" : "playing"}
        </span>
      </div>

      <HoverContext.Provider value={setHover}>
        <div className="min-h-0 flex-1">
          <Diagram
            fit
            viewBox="0 0 260 136"
            label="Detailed architecture: browser, Next.js server, Inngest orchestrator, Modal GPU container and the three stores"
          >
            {/* ---------------- 1. Browser ---------------- */}
            <Band
              x={2}
              y={4}
              w={188}
              h={21}
              title="Browser"
              to="contract"
              sub="React 19 · holds no authority"
              tone={TONE.info}
            />
            {[
              ["/", "home feed"],
              ["/create", "song-panel"],
              ["/favorites", "liked songs"],
              ["/customer-portal", "billing"],
              ["sound-bar", "player store"],
            ].map(([a, b], n) => (
              <Node
                key={a}
                x={5 + n * 37}
                y={12}
                w={35}
                h={10}
                lines={[a!, `· ${b}`]}
                tone={TONE.line}
              />
            ))}

            {/* ---------------- 2. Next.js web tier ---------------- */}
            <Band
              x={2}
              y={30}
              w={188}
              h={36}
              title="Next.js 16 — web tier"
              to="endpoints"
              sub="request-scoped · stateless · dies with the response"
              tone={TONE.accent}
            />
            <Node
              x={5}
              y={38}
              w={76}
              h={25}
              head='server actions — "use server"'
              headTone={TONE.accent}
              lines={[
                "generateSong()   getPlayUrl()",
                "recordListen()   toggleLikeSong()",
                "renameSong()     setPublishedStatus()",
                "getUserLikedSongs()",
                "· every export is a public endpoint",
              ]}
              tone={TONE.line}
            />
            <Node
              x={84}
              y={38}
              w={48}
              h={25}
              head="route handlers"
              headTone={TONE.accent}
              lines={[
                "/api/inngest",
                "/api/auth/[...all]",
                "",
                "· Inngest re-enters",
                "· the app here",
              ]}
              tone={TONE.line}
            />
            <Node
              x={135}
              y={38}
              w={53}
              h={25}
              head="lib"
              headTone={TONE.accent}
              lines={[
                "auth.ts  better-auth",
                "s3.ts    getPresignedUrl",
                "products.ts",
                "",
                '· s3.ts is import "server-only"',
              ]}
              tone={TONE.line}
            />

            {/* ---------------- 3. Inngest orchestrator ---------------- */}
            <Band
              x={2}
              y={70}
              w={188}
              h={28}
              title="Inngest — generate-song"
              to="durable"
              sub="durable · at-least-once · concurrency limit 1, key event.data.userId"
              tone={TONE.accent}
            />
            {[
              "prepare-request",
              "reserve-credit",
              "set-status-processing",
              "step.fetch(endpoint)",
              "update-song-result",
            ].map((s, n) => (
              <Node
                key={s}
                x={5 + n * 37}
                y={77}
                w={34}
                h={7.5}
                lines={[s]}
                tone={n === 1 || n === 4 ? TONE.ok : TONE.line}
              />
            ))}
            <Node
              x={5}
              y={87.5}
              w={183}
              h={8}
              lines={[
                "failure paths:   set-status-no-credits      refund-credit + set-status-failed      onFailure(event) — terminal, after retries",
              ]}
              tone={TONE.warn}
            />

            {/* ---------------- 4. Modal GPU container ---------------- */}
            <Band
              x={2}
              y={102}
              w={188}
              h={32}
              title="Modal — MusicGenServer"
              to="cost"
              sub="L40S · scaledown_window=10 · ephemeral · no DB access"
              tone={TONE.warn}
            />
            <Node
              x={5}
              y={110}
              w={90}
              h={21}
              head="@modal.fastapi_endpoint · requires_proxy_auth"
              headTone={TONE.warn}
              lines={[
                "generate_from_description",
                "generate_with_lyrics",
                "generate_with_described_lyrics",
              ]}
              tone={TONE.line}
            />
            <Node
              x={98}
              y={110}
              w={90}
              h={21}
              head="@modal.enter() load_model"
              headTone={TONE.warn}
              lines={[
                "ACEStepPipeline   /models · bfloat16",
                "Qwen2-7B-Instruct  prompt/lyrics/tags",
                "SDXL-Turbo         2 steps · gs 0.0",
              ]}
              tone={TONE.line}
            />

            {/* ---------------- stores column ---------------- */}
            <Band
              x={196}
              y={4}
              w={62}
              h={21}
              title="Polar"
              to="webhook"
              tone={TONE.ok}
            />
            <Node
              x={199}
              y={12}
              w={56}
              h={10}
              lines={["checkout() · webhooks", "· credits: { increment }"]}
              tone={TONE.line}
            />

            <Band
              x={196}
              y={30}
              w={62}
              h={36}
              title="Postgres"
              to="data"
              tone={TONE.ok}
            />
            <Node
              x={199}
              y={38}
              w={56}
              h={25}
              lines={[
                "Song  User  Like  Category",
                "Session  Account  Verification",
                "",
                "Song.status          5 values",
                "Song.creditReserved  refund gate",
                "Song.creditRefunded  replay gate",
              ]}
              tone={TONE.line}
            />

            <Band
              x={196}
              y={70}
              w={62}
              h={64}
              title="S3"
              to="capability"
              tone={TONE.ok}
            />
            <Node
              x={199}
              y={78}
              w={56}
              h={20}
              head="objects"
              lines={["{uuid}.wav   audio", "{uuid}.png   cover art"]}
              tone={TONE.line}
            />
            <Node
              x={199}
              y={101}
              w={56}
              h={30}
              head="read path"
              lines={[
                "GetObjectCommand",
                "getSignedUrl(expiresIn: 3600)",
                "",
                "· a bearer capability:",
                "· anyone holding the URL",
                "· can read for one hour",
              ]}
              tone={TONE.line}
            />

            {/* ---------------- edges ---------------- */}
            {/* Static reads, always shown — they are not part of the write path. */}
            {[
              { d: "M 189 47 L 196 47", label: "reads" },
              { d: "M 189 58 L 196 88", label: "presign" },
              { d: "M 214 25.5 L 160 30", label: "webhook" },
            ].map((e) => (
              <path
                key={e.d}
                d={e.d}
                fill="none"
                stroke={TONE.line}
                strokeWidth={0.4}
                strokeDasharray="1.6 1.4"
              />
            ))}

            {ARCH_EDGES.map((e) => {
              const on = e.id === active.id;
              return (
                <line
                  key={e.id}
                  x1={e.from[0]}
                  y1={e.from[1]}
                  x2={e.to[0]}
                  y2={e.to[1]}
                  className={boxClass}
                  stroke={on ? TONE.accent : TONE.neutral}
                  strokeWidth={on ? 1.1 : 0.5}
                />
              );
            })}

            <motion.circle
              r={1.7}
              fill={TONE.accent}
              cx={active.from[0]}
              cy={active.from[1]}
              initial={{ cx: active.from[0], cy: active.from[1] }}
              animate={{
                cx: [active.from[0], active.to[0]],
                cy: [active.from[1], active.to[1]],
              }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
            />
          </Diagram>
          {hover ? <HotspotTooltip hover={hover} /> : null}
        </div>
      </HoverContext.Provider>
    </div>
  );
}

/* ================================================================== *
 * 3. Sequence diagram
 * ================================================================== */

const LIFELINES = [
  { k: "br", x: 7, t: "Browser" },
  { k: "nx", x: 25, t: "Next" },
  { k: "pg", x: 43, t: "Postgres" },
  { k: "in", x: 61, t: "Inngest" },
  { k: "md", x: 78, t: "Modal" },
  { k: "s3", x: 93, t: "S3" },
] as const;

const LX: Record<string, number> = Object.fromEntries(
  LIFELINES.map((l) => [l.k, l.x]),
);

const MSGS = [
  { y: 16, a: "br", b: "nx", t: "generateSong()" },
  { y: 21, a: "nx", b: "pg", t: "INSERT queued" },
  { y: 26, a: "nx", b: "in", t: "send event" },
  { y: 31, a: "nx", b: "br", t: "return void", dash: true },
  { y: 39, a: "in", b: "pg", t: "read Song" },
  { y: 44, a: "in", b: "pg", t: "reserve credit" },
  { y: 49, a: "in", b: "md", t: "POST generate" },
  { y: 54, a: "md", b: "s3", t: "upload ×2" },
  { y: 59, a: "md", b: "in", t: "keys + tags" },
  { y: 64, a: "in", b: "pg", t: "UPDATE processed" },
  { y: 74, a: "br", b: "nx", t: "Refresh" },
  { y: 79, a: "nx", b: "pg", t: "read songs" },
  { y: 84, a: "nx", b: "s3", t: "presign" },
  { y: 89, a: "nx", b: "br", t: "HTML + URLs", dash: true },
] as const;

export function SequenceDiagram() {
  return (
    <Diagram viewBox="0 0 100 96" label="End to end sequence diagram">
      <rect
        x={2}
        y={34}
        width={96}
        height={36}
        rx={2}
        fill={TONE.warn}
        fillOpacity={0.08}
        stroke={TONE.warn}
        strokeDasharray="2 2"
        strokeWidth={0.3}
      />
      <text x={3.5} y={68.6} fontSize={2.2} fill={TONE.warn}>
        no client is waiting — the request already returned
      </text>

      {LIFELINES.map((l) => (
        <g key={l.k}>
          <text
            x={l.x}
            y={6.5}
            fontSize={2.4}
            textAnchor="middle"
            fill={TONE.ink}
          >
            {l.t}
          </text>
          <line
            x1={l.x}
            y1={9}
            x2={l.x}
            y2={94}
            stroke={TONE.line}
            strokeWidth={0.25}
          />
        </g>
      ))}

      <motion.g
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.12 } },
        }}
        initial="hidden"
        animate="show"
      >
        {MSGS.map((m, i) => {
          const x1 = LX[m.a]!;
          const x2 = LX[m.b]!;
          const mid = (x1 + x2) / 2;
          const dash = "dash" in m && m.dash;
          return (
            <motion.g
              key={i}
              variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
            >
              <line
                x1={x1}
                y1={m.y}
                x2={x2}
                y2={m.y}
                stroke={dash ? TONE.neutral : TONE.accent}
                strokeWidth={0.4}
                strokeDasharray={dash ? "1.2 1.2" : "0"}
              />
              <circle
                cx={x2}
                cy={m.y}
                r={0.8}
                fill={dash ? TONE.neutral : TONE.accent}
              />
              <text
                x={mid}
                y={m.y - 1.3}
                fontSize={1.9}
                textAnchor="middle"
                fill={TONE.neutral}
              >
                {m.t}
              </text>
            </motion.g>
          );
        })}
      </motion.g>
    </Diagram>
  );
}

/* ================================================================== *
 * 4. Entity relationship diagram
 * ================================================================== */

const ENTITIES = {
  user: {
    x: 2,
    y: 3,
    w: 27,
    h: 20,
    t: "User",
    f: ["id", "email @unique", "credits  @default(100)"],
  },
  song: {
    x: 36,
    y: 3,
    w: 32,
    h: 31,
    t: "Song",
    f: [
      "id",
      "status  @default(queued)",
      "s3Key / thumbnailS3Key",
      "creditReserved",
      "creditRefunded",
      "userId",
    ],
  },
  cat: { x: 74, y: 3, w: 24, h: 12, t: "Category", f: ["id", "name @unique"] },
  like: {
    x: 36,
    y: 40,
    w: 32,
    h: 12,
    t: "Like",
    f: ["@@id([userId, songId])"],
  },
  session: { x: 2, y: 28, w: 27, h: 11, t: "Session", f: ["token @unique"] },
  account: { x: 2, y: 43, w: 27, h: 11, t: "Account", f: ["providerId"] },
} as const;

type EntKey = keyof typeof ENTITIES;

/** Label coordinates are explicit: entity boxes differ in size, so a line
 *  midpoint can land inside the box it is labelling, or under a neighbour. */
const RELATIONS: readonly {
  a: EntKey;
  b: EntKey;
  t: string;
  lx: number;
  ly: number;
}[] = [
  { a: "user", b: "song", t: "1 : N", lx: 32.5, ly: 13 },
  { a: "song", b: "cat", t: "M : N", lx: 71, ly: 12 },
  { a: "song", b: "like", t: "1 : N", lx: 57.5, ly: 38 },
  { a: "user", b: "like", t: "1 : N", lx: 33.5, ly: 37 },
  { a: "user", b: "session", t: "1 : N", lx: 20, ly: 26.4 },
  { a: "user", b: "account", t: "1 : N", lx: 20, ly: 41.8 },
];

export const ER_LENSES = {
  money: {
    label: "money",
    fields: [
      "credits  @default(100)",
      "creditReserved",
      "creditRefunded",
    ] as string[],
    note: "Three columns carry the entire billing invariant. Two of them live on Song rather than User, so a refund can be decided per generation.",
  },
  state: {
    label: "lifecycle",
    fields: ["status  @default(queued)"] as string[],
    note: "One free-text column drives every branch the UI renders. It is a String, not an enum, so the database accepts any value.",
  },
  llm: {
    label: "LLM output",
    fields: ["name @unique", "s3Key / thumbnailS3Key"] as string[],
    note: "Category names are generated text inserted with connectOrCreate against a unique index. Near-duplicates that survive canonicalisation become separate rows.",
  },
} as const;

export type ErLens = keyof typeof ER_LENSES;

export function ErDiagram({ lens }: { lens: ErLens }) {
  const hot = ER_LENSES[lens].fields;
  return (
    <Diagram viewBox="0 0 100 56" label="Entity relationship diagram">
      {RELATIONS.map((r) => {
        const p = ENTITIES[r.a];
        const q = ENTITIES[r.b];
        return (
          <g key={`${r.a}-${r.b}`}>
            <line
              x1={p.x + p.w / 2}
              y1={p.y + p.h / 2}
              x2={q.x + q.w / 2}
              y2={q.y + q.h / 2}
              stroke={TONE.line}
              strokeWidth={0.3}
            />
            <text
              x={r.lx}
              y={r.ly}
              fontSize={1.8}
              textAnchor="middle"
              fill={TONE.neutral}
            >
              {r.t}
            </text>
          </g>
        );
      })}
      {(Object.keys(ENTITIES) as EntKey[]).map((k) => {
        const e = ENTITIES[k];
        return (
          <g key={k}>
            <rect
              x={e.x}
              y={e.y}
              width={e.w}
              height={e.h}
              rx={2}
              fill="var(--card)"
              stroke={TONE.line}
              strokeWidth={0.35}
            />
            <rect
              x={e.x}
              y={e.y}
              width={e.w}
              height={6}
              rx={2}
              fill={TONE.raised}
            />
            <text
              x={e.x + 1.6}
              y={e.y + 4.3}
              fontSize={2.5}
              fontWeight={600}
              fill={TONE.ink}
            >
              {e.t}
            </text>
            {e.f.map((f, i) => {
              const on = hot.includes(f);
              return (
                <text
                  key={f}
                  x={e.x + 1.6}
                  y={e.y + 9.6 + i * 3.6}
                  fontSize={1.9}
                  className={boxClass}
                  opacity={on ? 1 : 0.55}
                  fontWeight={on ? 600 : 400}
                  fill={on ? TONE.accent : TONE.neutral}
                >
                  {f}
                </text>
              );
            })}
          </g>
        );
      })}
    </Diagram>
  );
}

/* ================================================================== *
 * 5. Song state machine
 * ================================================================== */

const SM_NODES = {
  queued: { x: 6, y: 26, t: "queued" },
  processing: { x: 36, y: 26, t: "processing" },
  processed: { x: 70, y: 8, t: "processed" },
  failed: { x: 70, y: 30, t: "failed" },
  nocredits: { x: 36, y: 52, t: "no credits" },
} as const;

type SmKey = keyof typeof SM_NODES;

export const SM_EDGES: readonly {
  id: string;
  a: SmKey;
  b: SmKey;
  label: string;
  guard: string;
  src: string;
}[] = [
  {
    id: "t1",
    a: "queued",
    b: "processing",
    label: "credit reserved",
    guard:
      "reserve-credit returned true — a conditional updateMany matched a row with credits > 0",
    src: "functions.ts:186",
  },
  {
    id: "t2",
    a: "queued",
    b: "nocredits",
    label: "no balance",
    guard: "reserve-credit returned false. Terminal: no GPU call is ever made.",
    src: "functions.ts:175",
  },
  {
    id: "t3",
    a: "processing",
    b: "processed",
    label: "result persisted",
    guard:
      "Unguarded. The single update writes keys, status and categories together.",
    src: "functions.ts:223",
  },
  {
    id: "t4",
    a: "processing",
    b: "failed",
    label: "non-OK / run died",
    guard:
      'GUARDED: updateMany where status is not "processed". A finished song is never demoted.',
    src: "functions.ts:210",
  },
];

export function StateMachineDiagram({ selected }: { selected: string }) {
  const e = SM_EDGES.find((x) => x.id === selected) ?? SM_EDGES[0]!;
  return (
    <Diagram viewBox="0 0 100 66" label="Song status state machine">
      {SM_EDGES.map((x) => {
        const p = SM_NODES[x.a];
        const q = SM_NODES[x.b];
        const on = x.id === e.id;
        return (
          <line
            key={x.id}
            x1={p.x + 22}
            y1={p.y + 5}
            x2={q.x}
            y2={q.y + 5}
            className={boxClass}
            stroke={on ? TONE.accent : TONE.line}
            strokeWidth={on ? 0.8 : 0.35}
          />
        );
      })}
      {(Object.keys(SM_NODES) as SmKey[]).map((k) => {
        const n = SM_NODES[k];
        const on = k === e.a || k === e.b;
        return (
          <g key={k}>
            <rect
              x={n.x}
              y={n.y}
              width={22}
              height={10}
              rx={2}
              className={boxClass}
              opacity={on ? 1 : 0.55}
              fill={on ? "var(--card)" : TONE.raised}
              stroke={on ? TONE.accent : TONE.line}
              strokeWidth={on ? 0.6 : 0.3}
            />
            <text
              x={n.x + 11}
              y={n.y + 6.4}
              fontSize={3}
              textAnchor="middle"
              fill={TONE.ink}
            >
              {n.t}
            </text>
          </g>
        );
      })}
      <motion.circle
        r={1.4}
        fill={TONE.accent}
        cx={SM_NODES[e.a].x + 22}
        cy={SM_NODES[e.a].y + 5}
        initial={{ cx: SM_NODES[e.a].x + 22, cy: SM_NODES[e.a].y + 5 }}
        animate={{
          cx: [SM_NODES[e.a].x + 22, SM_NODES[e.b].x],
          cy: [SM_NODES[e.a].y + 5, SM_NODES[e.b].y + 5],
        }}
        transition={{
          duration: 1,
          ease: "easeInOut",
          repeat: Infinity,
          repeatDelay: 0.5,
        }}
      />
    </Diagram>
  );
}

/* ================================================================== *
 * 6. Dual write
 * ================================================================== */

export function DualWriteDiagram({
  orphan,
  rowWritten,
}: {
  orphan: boolean;
  rowWritten: boolean;
}) {
  return (
    <Diagram viewBox="0 0 100 40" label="Dual write across Postgres and S3">
      <rect
        x={2}
        y={4}
        width={30}
        height={12}
        rx={2}
        fill={TONE.raised}
        stroke={TONE.line}
        strokeWidth={0.3}
      />
      <text x={17} y={11.6} fontSize={3.1} textAnchor="middle" fill={TONE.ink}>
        Modal container
      </text>

      <rect
        x={66}
        y={2}
        width={32}
        height={14}
        rx={2}
        className={boxClass}
        fill={orphan ? TONE.bad : TONE.ok}
        fillOpacity={0.12}
        stroke={orphan ? TONE.bad : TONE.ok}
        strokeWidth={0.5}
      />
      <text x={82} y={8.4} fontSize={3.1} textAnchor="middle" fill={TONE.ink}>
        S3 — (A) bytes
      </text>
      <text
        x={82}
        y={13}
        fontSize={2.4}
        textAnchor="middle"
        fill={TONE.neutral}
      >
        {orphan ? "written, unreferenced" : "written"}
      </text>

      <rect
        x={66}
        y={24}
        width={32}
        height={14}
        rx={2}
        className={boxClass}
        opacity={rowWritten ? 1 : 0.4}
        fill={rowWritten ? TONE.ok : TONE.raised}
        fillOpacity={rowWritten ? 0.12 : 1}
        stroke={rowWritten ? TONE.ok : TONE.line}
        strokeWidth={0.4}
      />
      <text x={82} y={30.4} fontSize={3.1} textAnchor="middle" fill={TONE.ink}>
        Postgres — (B) row
      </text>
      <text
        x={82}
        y={35}
        fontSize={2.4}
        textAnchor="middle"
        fill={TONE.neutral}
      >
        {rowWritten ? "s3Key set" : "never written"}
      </text>

      <line
        x1={32}
        y1={10}
        x2={66}
        y2={9}
        stroke={TONE.accent}
        strokeWidth={0.5}
      />
      <line
        x1={32}
        y1={12}
        x2={66}
        y2={31}
        className={boxClass}
        stroke={rowWritten ? TONE.ok : TONE.line}
        strokeWidth={0.4}
        strokeDasharray={rowWritten ? "0" : "1.5 1.5"}
      />
    </Diagram>
  );
}

/* ================================================================== *
 * 7. Attack surface
 * ================================================================== */

export function AttackSurfaceDiagram({ before }: { before: boolean }) {
  return (
    <Diagram viewBox="0 0 100 34" label="Server action attack surface">
      <rect
        x={1}
        y={4}
        width={24}
        height={12}
        rx={2}
        fill={TONE.raised}
        stroke={TONE.line}
        strokeWidth={0.3}
      />
      <text x={13} y={11.4} fontSize={2.9} textAnchor="middle" fill={TONE.ink}>
        any client
      </text>

      <rect
        x={31}
        y={2}
        width={38}
        height={16}
        rx={2}
        className={boxClass}
        fill={before ? TONE.bad : TONE.raised}
        fillOpacity={before ? 0.14 : 1}
        stroke={before ? TONE.bad : TONE.line}
        strokeWidth={0.5}
      />
      <text x={50} y={8.6} fontSize={2.8} textAnchor="middle" fill={TONE.ink}>
        &quot;use server&quot; file
      </text>
      <text
        x={50}
        y={13.4}
        fontSize={2.1}
        textAnchor="middle"
        fill={TONE.neutral}
      >
        every export is an endpoint
      </text>

      <rect
        x={74}
        y={4}
        width={26}
        height={12}
        rx={2}
        className={boxClass}
        fill={before ? TONE.bad : TONE.ok}
        fillOpacity={0.13}
        stroke={before ? TONE.bad : TONE.ok}
        strokeWidth={0.5}
      />
      <text x={87} y={9} fontSize={2.6} textAnchor="middle" fill={TONE.ink}>
        getPresignedUrl
      </text>
      <text
        x={87}
        y={13.4}
        fontSize={2.2}
        textAnchor="middle"
        fill={TONE.neutral}
      >
        {before ? "reachable" : "server-only"}
      </text>

      <line
        x1={25}
        y1={10}
        x2={31}
        y2={10}
        stroke={TONE.line}
        strokeWidth={0.4}
      />
      <line
        x1={69}
        y1={10}
        x2={74}
        y2={10}
        className={boxClass}
        opacity={before ? 1 : 0.25}
        stroke={before ? TONE.bad : TONE.line}
        strokeWidth={0.5}
        strokeDasharray={before ? "0" : "1.5 1.5"}
      />
      <text x={50} y={27} fontSize={2.6} fill={before ? TONE.bad : TONE.ok}>
        {before
          ? "sign any key in the bucket, unauthenticated"
          : "no path from the network to the signer"}
      </text>
    </Diagram>
  );
}

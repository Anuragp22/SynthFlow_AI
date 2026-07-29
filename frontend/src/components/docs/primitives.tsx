"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { cn } from "~/lib/utils";

/* ------------------------------------------------------------------ *
 * Tone tokens
 *
 * Diagrams need raw colour strings (SVG fill/stroke cannot take Tailwind
 * classes), so semantic tones are mapped onto the design system's CSS
 * variables here rather than hard-coded per diagram. Dark mode therefore
 * comes for free from next-themes.
 * ------------------------------------------------------------------ */
export const TONE = {
  neutral: "var(--muted-foreground)",
  line: "var(--border)",
  accent: "var(--chart-1)",
  info: "var(--chart-3)",
  ok: "var(--chart-2)",
  warn: "var(--chart-5)",
  bad: "var(--destructive)",
  ink: "var(--foreground)",
  surface: "var(--card)",
  raised: "var(--muted)",
} as const;

export type Tone = keyof typeof TONE;

/* ------------------------------------------------------------------ *
 * Stagger helpers
 * ------------------------------------------------------------------ */
const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 320, damping: 30 },
  },
};

export function Stagger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={listVariants}
      initial="hidden"
      animate="show"
      className={cn("flex flex-col gap-2", className)}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * Panel — the box used inside mechanism columns
 * ------------------------------------------------------------------ */
const panelTone: Record<string, string> = {
  none: "border-border bg-muted/40",
  accent: "border-[color:var(--chart-1)] bg-[color:var(--chart-1)]/10",
  ok: "border-[color:var(--chart-2)] bg-[color:var(--chart-2)]/10",
  warn: "border-[color:var(--chart-5)] bg-[color:var(--chart-5)]/10",
  bad: "border-destructive bg-destructive/10",
  info: "border-[color:var(--chart-3)] bg-[color:var(--chart-3)]/10",
};

export function Panel({
  tone = "none",
  dim,
  title,
  children,
  className,
  onClick,
}: {
  tone?: keyof typeof panelTone;
  dim?: boolean;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-2 transition-colors",
        panelTone[tone],
        dim && "opacity-40",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {title ? (
        <div className="font-mono text-[11px] leading-tight font-semibold">
          {title}
        </div>
      ) : null}
      {children ? (
        <div className="text-muted-foreground mt-1 text-xs leading-snug">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Segmented control — every interactive teaching control on the page
 * ------------------------------------------------------------------ */
export function Segmented<T extends string | number | boolean>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="bg-muted/50 mb-3 flex flex-wrap items-center gap-1.5 rounded-lg border px-2.5 py-2">
      <span className="text-muted-foreground mr-1 font-mono text-[10px] font-semibold tracking-widest uppercase">
        {label}
      </span>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs transition-colors",
              active
                ? "bg-primary text-primary-foreground border-transparent font-medium"
                : "bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Chip({
  children,
  tone = "none",
  className,
}: {
  children: React.ReactNode;
  tone?: "none" | "accent";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-md border px-2 py-1 font-mono text-[10px] font-semibold",
        tone === "accent"
          ? "bg-primary text-primary-foreground border-transparent"
          : "bg-muted/60 text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function CodeBlock({
  caption,
  children,
}: {
  caption?: string;
  children: string;
}) {
  return (
    <figure className="m-0">
      {caption ? (
        <figcaption className="text-muted-foreground mb-1.5 font-mono text-[10px] font-medium tracking-widest uppercase">
          {caption}
        </figcaption>
      ) : null}
      <pre className="bg-muted/60 overflow-x-auto rounded-lg border p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre">
        {children}
      </pre>
    </figure>
  );
}

export function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground mt-3 text-[11.5px] leading-relaxed italic">
      {children}
    </p>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground mb-1.5 font-mono text-[10px] font-medium tracking-widest uppercase">
      {children}
    </p>
  );
}

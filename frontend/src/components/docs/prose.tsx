"use client";

import * as React from "react";

import { cn } from "~/lib/utils";
import { StageLink } from "./stage-link";

/**
 * Inline markup for documentation copy.
 *
 * Prose is authored as plain strings rather than JSX so the stage content stays
 * data. Four markers are supported:
 *
 *   `code`             -> <code>
 *   **strong**         -> <strong>
 *   ~emphasis~         -> <em>
 *   [[stage-id|text]]  -> a link that jumps to that stage
 *
 * The cross-reference marker is what lets a fact be stated once. Rather than
 * repeating "Song has only an s3Key index" in four stages, the stage that owns
 * the claim states it and the others point at it.
 *
 * Keeping it string-based also means the copy can be diffed, searched and
 * reused without dragging JSX through the content files.
 */
const MARKER =
  /`([^`]+)`|\*\*([^*]+)\*\*|~([^~]+)~|\[\[([a-z-]+)\|([^\]]+)\]\]/g;

export function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  let match: RegExpExecArray | null;

  MARKER.lastIndex = 0;
  while ((match = MARKER.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));

    const [, codeText, strongText, emText, linkTarget, linkText] = match;
    const key = `${keyBase}-${i++}`;

    if (codeText !== undefined) {
      out.push(
        <code
          key={key}
          className="bg-muted rounded border px-1 py-0.5 font-mono text-[0.85em]"
        >
          {codeText}
        </code>,
      );
    } else if (strongText !== undefined) {
      out.push(
        <strong key={key} className="text-foreground font-semibold">
          {strongText}
        </strong>,
      );
    } else if (linkTarget !== undefined) {
      out.push(
        <StageLink key={key} to={linkTarget}>
          {linkText}
        </StageLink>,
      );
    } else {
      out.push(
        <em key={key} className="italic">
          {emText}
        </em>,
      );
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Prose({
  paragraphs,
  className,
}: {
  paragraphs: readonly string[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      {paragraphs.map((p, i) => (
        <p key={i} className="text-muted-foreground text-sm leading-relaxed">
          {inline(p, `p${i}`)}
        </p>
      ))}
    </div>
  );
}

"use client";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { LucideIcon } from "lucide-react";

interface IconOpts {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/**
 * Render a Lucide icon component to an SVG HTML string. Intended for
 * ProseMirror widget toDOM callbacks where we build raw DOM by hand and can't
 * use React directly. Cached per-icon by reference + opts shape.
 */
const cache = new WeakMap<LucideIcon, Map<string, string>>();

export function lucideToHtml(Icon: LucideIcon, opts: IconOpts = {}): string {
  // Client-only: renderToStaticMarkup during SSR import throws an
  // invalid-hook-call under Turbopack. These icons only feed ProseMirror
  // widgets, which build their DOM in the browser, so the server never needs a
  // real string.
  if (typeof window === "undefined") return "";
  let perIcon = cache.get(Icon);
  if (!perIcon) {
    perIcon = new Map();
    cache.set(Icon, perIcon);
  }
  const cacheKey = `${opts.size ?? ""}|${opts.strokeWidth ?? ""}|${opts.className ?? ""}`;
  const hit = perIcon.get(cacheKey);
  if (hit) return hit;
  const html = renderToStaticMarkup(
    createElement(Icon, {
      ...(opts.size !== undefined && { size: opts.size }),
      ...(opts.strokeWidth !== undefined && { strokeWidth: opts.strokeWidth }),
      ...(opts.className !== undefined && { className: opts.className }),
      "aria-hidden": true,
    }),
  );
  perIcon.set(cacheKey, html);
  return html;
}

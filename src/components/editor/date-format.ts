const TOKEN_RE = /YYYY|YY|MM|DD/g;

const TOKEN_PATTERN: Record<string, string> = {
  YYYY: "\\d{4}",
  YY: "\\d{2}",
  MM: "\\d{1,2}",
  DD: "\\d{1,2}",
};

function escapeLiteral(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");
}

function compileSegment(segment: string): string {
  let out = "";
  let cursor = 0;
  for (const match of segment.matchAll(TOKEN_RE)) {
    const start = match.index!;
    out += escapeLiteral(segment.slice(cursor, start));
    out += TOKEN_PATTERN[match[0]];
    cursor = start + match[0].length;
  }
  out += escapeLiteral(segment.slice(cursor));
  return out;
}

export function compileDateFormat(format: string): RegExp {
  let pattern = "";
  let buffer = "";
  let depth = 0;
  let optional = "";

  for (const ch of format) {
    if (ch === "[") {
      pattern += compileSegment(buffer);
      buffer = "";
      depth++;
      continue;
    }
    if (ch === "]") {
      if (depth > 0) {
        pattern += `(?:${compileSegment(optional + buffer)})?`;
        optional = "";
        buffer = "";
        depth--;
        continue;
      }
    }
    if (depth > 0) optional += ch;
    else buffer += ch;
  }
  pattern += compileSegment(buffer);

  return new RegExp(`^${pattern}$`);
}

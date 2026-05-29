"use client";

import { useMemo, useState } from "react";
import { useSettings } from "@/lib/settings";
import {
  classifyLine,
  defaultRules,
  sortRules,
} from "@/components/editor/default-rules";
import {
  parseSetLine,
  type ParsedSetLine,
} from "@/components/editor/set-parser";
import type { LineKind } from "@/components/editor/types";

const SAMPLE = [
  "27/05",
  "Tirage vertical (large)",
  "E 52kg x 8",
  "66kg x 8 x 3",
  "14kg x ((8 x 2) + (4 x 2) + (5 x 2))",
  "73kg x 1 + 66kg x 5",
  "100kg x 20 x 3 (fin de séance)",
  "30kg x 10 ???",
  "' dur dans les épaules",
  "Circuit Abdos (x2)",
  "- 10 levés de genoux collés",
  "- 10 levés de jambes",
  "- 5 x 2 levés de genoux",
].join("\n");

interface Row {
  line: string;
  kind: LineKind | null;
  parsed: ParsedSetLine | null;
}

export function DebugView() {
  const settings = useSettings();
  const [text, setText] = useState(SAMPLE);

  const sorted = useMemo(() => sortRules(defaultRules), []);

  const rows = useMemo<Row[]>(() => {
    const markerRe = new RegExp(
      `^\\s*${settings.warmupMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`,
      "i",
    );
    return text.split("\n").map((line) => {
      const kind = classifyLine(line, sorted, settings);
      let parsed: ParsedSetLine | null = null;
      if (kind === "working-set" || kind === "warmup-set") {
        const body = kind === "warmup-set" ? line.replace(markerRe, "") : line;
        parsed = parseSetLine(body);
      }
      return { line, kind, parsed };
    });
  }, [text, sorted, settings]);

  return (
    <div className="debug-view">
      <h1 className="debug-title">Parser debug</h1>
      <p className="debug-hint">
        Each line is classified, and set lines are parsed into structured
        objects. Dev-only route.
      </p>
      <textarea
        className="debug-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        rows={12}
      />
      <div className="debug-rows">
        {rows.map((row, i) => (
          <div key={i} className="debug-row">
            <div className="debug-row-head">
              <span className={`debug-kind debug-kind-${row.kind ?? "none"}`}>
                {row.kind ?? "—"}
              </span>
              <code className="debug-line">{row.line || " "}</code>
            </div>
            {row.parsed && (
              <div className="debug-parsed">
                <div className="debug-summary">
                  {row.parsed.ok ? (
                    <>
                      <span>{row.parsed.totalSets} sets</span>
                      <span>{row.parsed.totalReps} reps</span>
                      <span>vol {row.parsed.volume}</span>
                      {row.parsed.note && <span>note: {row.parsed.note}</span>}
                      {row.parsed.flagged && <span>⚑ flagged</span>}
                    </>
                  ) : (
                    <span className="debug-error">
                      parse error: {row.parsed.error}
                    </span>
                  )}
                </div>
                <pre className="debug-json">
                  {JSON.stringify(row.parsed, null, 2)}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

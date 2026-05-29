"use client";

import { useMemo, useState } from "react";
import type * as Y from "yjs";
import { useSettings } from "@/lib/settings";
import { useSynonyms } from "@/lib/synonyms";
import { useExerciseStats } from "@/lib/stats/use-exercise-stats";
import type { SessionStat } from "@/lib/stats/types";
import { Sparkline } from "./Sparkline";

type Metric = "top" | "e1rm" | "volume";

const METRIC_LABEL: Record<Metric, string> = {
  top: "Top set",
  e1rm: "Est. 1RM",
  volume: "Volume",
};

function trimNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
function fmtWeight(n: number): string {
  return `${trimNum(n)}kg`;
}
function fmtVolume(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}t` : `${Math.round(n)}kg`;
}
function metricValue(s: SessionStat, m: Metric): number | null {
  return m === "top" ? s.topWeight : m === "e1rm" ? s.est1RM : s.volume;
}
function fmtMetric(m: Metric, v: number | null): string {
  if (v === null) return "—";
  return m === "volume"
    ? fmtVolume(v)
    : m === "e1rm"
      ? String(Math.round(v))
      : fmtWeight(v);
}

export function StatsSection({ ydoc }: { ydoc: Y.Doc }) {
  const settings = useSettings();
  const synonyms = useSynonyms(ydoc);
  const { exercises, status, meta } = useExerciseStats(
    ydoc,
    settings,
    synonyms,
  );

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("top");

  const selected = useMemo(
    () => exercises.find((e) => e.key === selectedKey) ?? exercises[0] ?? null,
    [exercises, selectedKey],
  );

  // Oldest → newest, for the trend line.
  const trend = useMemo(() => {
    if (!selected) return [];
    return selected.sessions
      .map((s) => metricValue(s, metric))
      .filter((v): v is number => v !== null)
      .reverse();
  }, [selected, metric]);

  return (
    <section className="profile-section">
      <h2 className="profile-section-title">Statistics</h2>

      {status === "loading" && exercises.length === 0 && (
        <p className="stats-muted">Crunching your history…</p>
      )}

      {status === "ready" && exercises.length === 0 && (
        <p className="stats-muted">
          No exercises yet. Log a few sets and they&apos;ll show up here.
        </p>
      )}

      {selected && (
        <div className="stats-body">
          <div className="stats-controls">
            <select
              className="stats-select"
              value={selected.key}
              onChange={(e) => setSelectedKey(e.target.value)}
              aria-label="Exercise"
            >
              {exercises.map((e) => (
                <option key={e.key} value={e.key}>
                  {e.displayName} · {e.sessionCount}
                </option>
              ))}
            </select>
          </div>

          <div className="stats-prs">
            <Pr label="top set" value={selected.prTopWeight} fmt={fmtWeight} />
            <Pr
              label="est 1RM"
              value={selected.prEst1RM}
              fmt={(v) => String(Math.round(v))}
            />
            <Pr label="volume" value={selected.prVolume} fmt={fmtVolume} />
          </div>

          <div className="stats-trend">
            <div
              className="stats-metric-toggle"
              role="group"
              aria-label="Trend metric"
            >
              {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`stats-metric-btn${m === metric ? " active" : ""}`}
                  onClick={() => setMetric(m)}
                >
                  {METRIC_LABEL[m]}
                </button>
              ))}
            </div>
            <Sparkline values={trend} />
          </div>

          <ol className="stats-sessions">
            {selected.sessions.map((s, i) => (
              <li className="stats-session" key={`${s.date}-${i}`}>
                <div className="stats-session-head">
                  <span className="stats-date">{s.date}</span>
                  <span className="stats-badges">
                    {s.prTopWeight && (
                      <span className="stats-badge" title="Top-set PR">
                        ★ top
                      </span>
                    )}
                    {s.prEst1RM && (
                      <span className="stats-badge" title="Estimated-1RM PR">
                        ★ 1RM
                      </span>
                    )}
                    {s.prVolume && (
                      <span className="stats-badge" title="Volume PR">
                        ★ vol
                      </span>
                    )}
                  </span>
                  <span className="stats-metric-val">
                    {fmtMetric(metric, metricValue(s, metric))}
                  </span>
                </div>
                <div className="stats-sets">
                  {s.sets.map((set, j) => (
                    <span
                      key={j}
                      className={`stats-set${set.warmup ? " warmup" : ""}${
                        set.flagged ? " flagged" : ""
                      }`}
                    >
                      {set.raw.trim()}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ol>

          {meta && (
            <p className="stats-meta">
              {meta.computedDays} day{meta.computedDays === 1 ? "" : "s"}{" "}
              re-parsed, {meta.cachedDays} cached
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Pr({
  label,
  value,
  fmt,
}: {
  label: string;
  value: { value: number; date: string } | null;
  fmt: (v: number) => string;
}) {
  if (!value) return null;
  return (
    <span className="stats-pr" title={`on ${value.date}`}>
      <b>{fmt(value.value)}</b> {label}
    </span>
  );
}

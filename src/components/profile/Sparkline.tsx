"use client";

interface Props {
  /** Oldest → newest. */
  values: number[];
  width?: number;
  height?: number;
}

/** Minimal dependency-free trend line for a single metric over time. */
export function Sparkline({ values, width = 280, height = 48 }: Props) {
  const pad = 4;
  const w = width - pad * 2;
  const h = height - pad * 2;

  if (values.length === 0) {
    return (
      <div className="sparkline-empty" style={{ height }}>
        no trend yet
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = values.length > 1 ? w / (values.length - 1) : 0;

  const point = (v: number, i: number): [number, number] => {
    const x = pad + (values.length > 1 ? i * stepX : w / 2);
    const y = pad + h - ((v - min) / span) * h;
    return [x, y];
  };

  const pts = values.map(point);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = pts[pts.length - 1];

  return (
    <svg
      className="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {values.length > 1 ? (
        <polyline
          points={line}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}
      <circle cx={lastX} cy={lastY} r={2.5} fill="var(--color-accent)" />
    </svg>
  );
}

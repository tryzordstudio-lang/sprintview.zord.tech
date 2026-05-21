import { useId } from "react";

function buildPath(points, width, height, padding = 10) {
  if (!points || !points.length) {
    return "";
  }

  const values = points.map((point) => point.value);
  const maxVal = Math.max(...values, 0);
  const minVal = Math.min(...values, 0);
  const diff = maxVal - minVal;
  // Handle case where all values are same
  const max = diff === 0 ? (maxVal === 0 ? 1 : maxVal * 2) : maxVal;
  const chartHeight = height - padding * 2;

  if (points.length === 1) {
    const y = height - padding - (points[0].value / max) * chartHeight;
    return `M 0 ${y} L ${width} ${y}`;
  }

  const stepX = width / Math.max(points.length - 1, 1);

  return points
    .map((point, index) => {
      const x = index * stepX;
      const y = height - padding - (point.value / max) * chartHeight;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

export function SparklineChart({ data }) {
  const gradientId = useId();
  const width = 320;
  const height = 120;
  const padding = 10;
  const path = buildPath(data, width, height, padding);
  const axisStyle = {
    gridTemplateColumns: `repeat(${Math.max(data.length, 1)}, minmax(0, 1fr))`
  };

  const values = data.map((point) => point.value);
  const maxVal = Math.max(...values, 0);
  const minVal = Math.min(...values, 0);
  const diff = maxVal - minVal;
  const max = diff === 0 ? (maxVal === 0 ? 1 : maxVal * 2) : maxVal;
  const chartHeight = height - padding * 2;
  const stepX = width / Math.max(data.length - 1, 1);

  const points = data.map((point, index) => {
    const x = data.length === 1 ? width / 2 : index * stepX;
    const y = height - padding - (point.value / max) * chartHeight;
    return { x, y, value: point.value, label: point.label };
  });

  return (
    <div className="chart-stack">
      <svg viewBox={`0 0 ${width} ${height + 20}`} className="sparkline-chart" role="img" aria-label="Trend chart">
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="rgba(26, 115, 232, 0.32)" />
            <stop offset="100%" stopColor="rgba(26, 115, 232, 0)" />
          </linearGradient>
        </defs>
        {data.length > 0 && (
          <>
            <path
              d={
                data.length === 1
                  ? `M 0 ${height} L 0 ${points[0].y} L ${width} ${points[0].y} L ${width} ${height} Z`
                  : `M 0 ${height} ${path} L ${width} ${height} Z`
              }
              fill={`url(#${gradientId})`}
            />
            <path d={path} className="sparkline-stroke" />
            
            {/* Elegant Data Points on Trend Line */}
            {points.map((p, index) => (
              <g key={index} className="sparkline-dot-group">
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="6"
                  className="sparkline-dot-glow"
                  style={{
                    fill: "var(--ai)",
                    opacity: 0,
                    transition: "opacity 0.2s ease, r 0.2s ease",
                  }}
                />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="3.5"
                  className="sparkline-dot"
                  style={{
                    fill: "var(--surface)",
                    stroke: "var(--ai)",
                    strokeWidth: 2.2,
                    transition: "r 0.2s ease",
                    cursor: "pointer"
                  }}
                >
                  <title>{`${p.label}: ${p.value}`}</title>
                </circle>
              </g>
            ))}
          </>
        )}
      </svg>
      <div className="chart-axis" style={axisStyle}>
        {data.map((item) => (
          <span key={item.label}>{item.label}</span>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({ data }) {
  const rawTotal = data.reduce((sum, item) => sum + item.value, 0);
  const total = rawTotal || 1;
  let start = 0;

  // Filter out items with 0 values for drawing segments
  const activeSegments = data.filter((item) => item.value > 0);

  return (
    <div className="donut-layout">
      <svg viewBox="0 0 120 120" className="donut-chart" role="img" aria-label="Distribution chart">
        {rawTotal === 0 ? (
          // Empty/placeholder state
          <circle
            cx="60"
            cy="60"
            r="42"
            fill="none"
            stroke="var(--border)"
            strokeWidth="14"
            style={{ opacity: 0.4 }}
          />
        ) : activeSegments.length === 1 ? (
          // 100% single segment state
          <circle
            cx="60"
            cy="60"
            r="42"
            fill="none"
            className={`chart-tone-${activeSegments[0].tone || "default"}`}
            strokeWidth="14"
            style={{ transition: "stroke-width 0.25s ease" }}
          />
        ) : (
          // Multiple segments state
          activeSegments.map((item) => {
            const value = item.value / total;
            const end = start + value;
            const largeArc = value > 0.5 ? 1 : 0;
            const startAngle = start * Math.PI * 2 - Math.PI / 2;
            const endAngle = end * Math.PI * 2 - Math.PI / 2;
            const x1 = 60 + 42 * Math.cos(startAngle);
            const y1 = 60 + 42 * Math.sin(startAngle);
            const x2 = 60 + 42 * Math.cos(endAngle);
            const y2 = 60 + 42 * Math.sin(endAngle);
            const strokeClass = `chart-tone-${item.tone || "default"}`;
            const path = `M ${x1} ${y1} A 42 42 0 ${largeArc} 1 ${x2} ${y2}`;
            start = end;

            return <path key={item.label} d={path} className={strokeClass} />;
          })
        )}
        <circle cx="60" cy="60" r="24" className="donut-hole" />
      </svg>

      <div className="chart-legend">
        {data.map((item) => {
          const percentage = rawTotal > 0 ? Math.round((item.value / rawTotal) * 100) : 0;
          return (
            <div key={item.label} className="legend-row">
              <span className={`legend-dot chart-tone-fill-${item.tone || "default"}`} />
              <span className="legend-label">{item.label}</span>
              <strong className="legend-value">
                {item.value} <span className="legend-pct">({percentage}%)</span>
              </strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BarChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="bar-chart-empty">
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0, textAlign: "center", padding: "20px" }}>
          No workload assigned in this sprint.
        </p>
      </div>
    );
  }

  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="bar-chart">
      {data.map((item) => {
        const displayValue = item.points !== undefined ? `${item.points} pts (${item.value}%)` : `${item.value}%`;
        return (
          <div key={item.label} className="bar-row">
            <div className="bar-meta">
              <span>{item.label}</span>
              <strong>{displayValue}</strong>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(item.value / max) * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

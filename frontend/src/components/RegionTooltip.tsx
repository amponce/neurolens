const CATEGORY_COLORS: Record<string, string> = {
  visual: "#ffab40",
  auditory: "#00e5ff",
  motor: "#7c4dff",
  language: "#10b981",
  limbic: "#ef4444",
  prefrontal: "#3b82f6",
  default: "#64748b",
};

function getCategoryColor(category: string): string {
  const key = category.toLowerCase();
  for (const [prefix, color] of Object.entries(CATEGORY_COLORS)) {
    if (key.includes(prefix)) return color;
  }
  return CATEGORY_COLORS.default;
}

interface RegionTooltipProps {
  name: string;
  category: string;
  value: number;
}

export function RegionTooltip({ name, category, value }: RegionTooltipProps) {
  const dotColor = getCategoryColor(category);

  return (
    <div
      className="glass-panel absolute top-4 left-4 pointer-events-none"
      style={{
        padding: "0.75rem 1rem",
        borderRadius: 12,
        minWidth: 160,
        position: "absolute",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.4375rem", marginBottom: "0.1875rem" }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: dotColor,
            boxShadow: `0 0 6px ${dotColor}`,
            flexShrink: 0,
          }}
        />
        <p
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "0.875rem",
            color: "var(--color-text)",
            margin: 0,
          }}
        >
          {name}
        </p>
      </div>

      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.75rem",
          color: "var(--color-text-muted)",
          margin: 0,
          paddingLeft: "1.1875rem",
        }}
      >
        {category}
      </p>

      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.75rem",
          color: "var(--color-cyan)",
          margin: "0.25rem 0 0",
          paddingLeft: "1.1875rem",
        }}
      >
        Activation: {(value * 100).toFixed(0)}%
      </p>
    </div>
  );
}

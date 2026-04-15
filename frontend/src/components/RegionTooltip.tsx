import { useEffect, useState } from "react";

const CATEGORY_COLORS: Record<string, string> = {
  visual: "#f59e0b",
  auditory: "#60a5fa",
  motor: "#a78bfa",
  language: "#34d399",
  limbic: "#f87171",
  prefrontal: "#60a5fa",
  default: "#94a3b8",
};

function getCategoryColor(category: string): string {
  const key = category.toLowerCase();
  for (const [prefix, color] of Object.entries(CATEGORY_COLORS)) {
    if (key.includes(prefix)) return color;
  }
  return CATEGORY_COLORS.default;
}

function activationLabel(value: number): { text: string; color: string } {
  if (value >= 0.8) return { text: "Very High", color: "#fbbf24" };
  if (value >= 0.6) return { text: "High", color: "#fb923c" };
  if (value >= 0.4) return { text: "Moderate", color: "#f87171" };
  if (value >= 0.2) return { text: "Low", color: "#94a3b8" };
  return { text: "Minimal", color: "#64748b" };
}

interface RegionTooltipProps {
  name: string;
  fullName?: string;
  category: string;
  value: number;
}

export function RegionTooltip({ name, fullName, category, value }: RegionTooltipProps) {
  const dotColor = getCategoryColor(category);
  const activation = activationLabel(value);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: 16,
        pointerEvents: "none",
        zIndex: 20,
        padding: "0.875rem 1.125rem",
        borderRadius: 14,
        minWidth: 200,
        maxWidth: 320,
        background: "rgba(8, 14, 28, 0.88)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: `1px solid rgba(${dotColor === "#f59e0b" ? "245,158,11" : dotColor === "#60a5fa" ? "96,165,250" : dotColor === "#a78bfa" ? "167,139,250" : dotColor === "#34d399" ? "52,211,153" : dotColor === "#f87171" ? "248,113,113" : "148,163,184"}, 0.25)`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.05)`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-6px)",
        transition: "opacity 0.2s ease-out, transform 0.2s ease-out",
      }}
    >
      {/* Region name row */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: dotColor,
            boxShadow: `0 0 8px ${dotColor}`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "0.8125rem",
            color: "#f1f5f9",
            letterSpacing: "0.01em",
          }}
        >
          {name}
        </span>
      </div>

      {/* Full name */}
      {fullName && fullName !== name && (
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.6875rem",
            color: "rgba(148, 163, 184, 0.8)",
            margin: "0.25rem 0 0",
            paddingLeft: "1.1875rem",
            lineHeight: 1.35,
          }}
        >
          {fullName}
        </p>
      )}

      {/* Divider */}
      <div
        style={{
          height: 1,
          background: "rgba(255,255,255,0.06)",
          margin: "0.5rem 0",
        }}
      />

      {/* Category + Activation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: "1.1875rem" }}>
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.6875rem",
            color: "rgba(148, 163, 184, 0.7)",
            textTransform: "capitalize",
          }}
        >
          {category}
        </span>
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.6875rem",
            fontWeight: 600,
            color: activation.color,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {activation.text} · {(value * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

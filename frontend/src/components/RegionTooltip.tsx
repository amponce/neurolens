interface RegionTooltipProps {
  name: string;
  category: string;
  value: number;
}

export function RegionTooltip({ name, category, value }: RegionTooltipProps) {
  return (
    <div className="absolute top-4 left-4 bg-gray-900/90 border border-gray-700 rounded-lg px-4 py-3 pointer-events-none backdrop-blur-sm">
      <p className="text-white font-semibold">{name}</p>
      <p className="text-gray-400 text-sm">{category}</p>
      <p className="text-cyan-400 text-sm mt-1">
        Activation: {(value * 100).toFixed(0)}%
      </p>
    </div>
  );
}

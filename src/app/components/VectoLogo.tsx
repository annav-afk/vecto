/**
 * Vecto brand logo — vector arrow on a deep blue rounded square.
 * Usage: <VectoLogo size={32} glow />
 */
export function VectoLogo({ size = 32, glow = false, className = '' }: { size?: number; glow?: boolean; className?: string }) {
  return (
    <div
      className={`relative flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <div
        className="absolute inset-0 rounded-[28%]"
        style={{
          background: 'linear-gradient(160deg, #1d4ed8 0%, #1e40af 60%, #172554 100%)',
          boxShadow: glow
            ? '0 0 32px rgba(29,78,216,0.55)'
            : '0 4px 16px rgba(29,78,216,0.3)',
        }}
      />
      <div className="absolute inset-0 rounded-[28%] bg-gradient-to-b from-white/20 to-transparent" />
      <svg
        className="relative"
        width={size * 0.52}
        height={size * 0.52}
        viewBox="0 0 24 24"
        fill="none"
      >
        {/* Subtle grid dots */}
        {[4, 8, 12, 16, 20].map(x =>
          [4, 8, 12, 16, 20].map(y => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="0.5" fill="white" opacity="0.15" />
          ))
        )}
        {/* Vector arrow */}
        <path d="M5 19L19 5" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M13 5h6v6" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Origin dot */}
        <circle cx="5" cy="19" r="2" fill="white" opacity="0.6" />
        {/* Target */}
        <circle cx="19" cy="5" r="2.5" fill="white" opacity="0.3" />
        <circle cx="19" cy="5" r="1.2" fill="white" />
      </svg>
    </div>
  );
}

/** Standard font style for the "Vecto" brand name */
export const VECTO_FONT_STYLE = {
  fontFamily: "'Syne', sans-serif",
  fontWeight: 700,
  letterSpacing: '0.02em',
} as const;

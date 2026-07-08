export function AppIcon({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="#0f172a" />
      <rect x="1" y="1" width="30" height="30" rx="7" stroke="#22d3ee" strokeOpacity="0.4" strokeWidth="1" />
      <defs>
        <linearGradient id="ap-gradient" x1="6" y1="6" x2="26" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22d3ee" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
        fontSize="13"
        fontWeight="700"
        letterSpacing="-0.5"
        fill="url(#ap-gradient)"
      >
        AP
      </text>
    </svg>
  );
}

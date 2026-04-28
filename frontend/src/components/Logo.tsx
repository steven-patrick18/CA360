interface LogoProps {
  size?: number
  className?: string
}

/**
 * Reusable CA monogram. Inline SVG so it scales crisply at any size and
 * inherits CSS color/sizing without an extra HTTP request. The same artwork
 * is also exposed as /ca-logo.svg for the browser favicon.
 */
export default function Logo({ size = 32, className = '' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="CA logo"
      className={className}
    >
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="logo-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="12" fill="url(#logo-bg)" />
      <rect x="2" y="2" width="60" height="60" rx="12" fill="url(#logo-shine)" />
      <text
        x="32"
        y="45"
        textAnchor="middle"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        fontSize="32"
        fontWeight="700"
        fill="#ffffff"
        letterSpacing="-1.5"
      >
        CA
      </text>
      <line
        x1="14"
        y1="52"
        x2="50"
        y2="52"
        stroke="#ffffff"
        strokeOpacity="0.6"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

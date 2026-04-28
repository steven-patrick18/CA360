interface LogoProps {
  size?: number
  className?: string
}

/**
 * Renders /ca-logo.svg as an <img>. To use your firm's official logo
 * (e.g. the ICAI-issued CA INDIA mark you're entitled to use as a member),
 * just replace /public/ca-logo.svg with that file. Every screen that
 * imports this component will pick up the new artwork on next refresh —
 * no code changes needed. PNG works too: rename your file to
 * ca-logo.svg, OR change the src below to /ca-logo.png.
 */
export default function Logo({ size = 32, className = '' }: LogoProps) {
  return (
    <img
      src="/ca-logo.svg"
      width={size}
      height={size}
      alt="Firm logo"
      className={className}
      style={{ width: size, height: size, display: 'block' }}
    />
  )
}

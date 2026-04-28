import { useAuth } from '../lib/auth'

interface LogoProps {
  size?: number
  className?: string
}

/**
 * Renders the firm's uploaded logo if available, otherwise falls back to the
 * placeholder at /ca-logo.svg. Managing Partners can upload a logo from
 * Settings → Firm. The placeholder file can also be replaced directly on
 * disk if you'd rather hard-bake the logo into the build.
 */
export default function Logo({ size = 32, className = '' }: LogoProps) {
  // useAuth throws when used outside AuthProvider — login & 2FA pages render
  // before the provider's user is loaded, but the provider itself wraps both,
  // so this is safe. We just guard against the user being null.
  const { user } = useAuth()
  const src = user?.firmLogoDataUrl || '/ca-logo.svg'

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt="Firm logo"
      className={className}
      style={{ width: size, height: size, objectFit: 'contain', display: 'block' }}
    />
  )
}

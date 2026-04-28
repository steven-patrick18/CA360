/**
 * Centralised branding constants used on screens where the firm name from the
 * authenticated user isn't available yet (login / 2FA pages).
 *
 * For sidebars / headers shown to logged-in users, prefer
 *   useAuth().user?.firmName
 * because that reflects the live database value (set per firm).
 */
export const BRANDING = {
  firmName: 'G Gaurav & Associates',
  tagline: 'Chartered Accountants — Practice Management',
  appName: 'CA360',
}

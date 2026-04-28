export default function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'sm' ? 'h-4 w-4 border-2' : size === 'lg' ? 'h-8 w-8 border-4' : 'h-5 w-5 border-2'
  return (
    <span
      className={`inline-block ${dim} animate-spin rounded-full border-slate-300 border-t-blue-600`}
      aria-label="Loading"
    />
  )
}

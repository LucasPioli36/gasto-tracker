type Props = {
  value: number
  max: number
  size?: 'sm' | 'md'
}

export default function ProgressBar({ value, max, size = 'md' }: Props) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const color =
    pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
  const h = size === 'sm' ? 'h-1.5' : 'h-2.5'

  return (
    <div className={`w-full bg-gray-800 rounded-full ${h} overflow-hidden`}>
      <div
        className={`${color} ${h} rounded-full transition-all duration-500`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

type Props = { year: number | 'all'; onChange: (y: number) => void; allowAll?: boolean; onAll?: () => void }

export default function YearPicker({ year, onChange, allowAll, onAll }: Props) {
  const center = year === 'all' ? new Date().getFullYear() : year
  const start = Math.max(2020, center - 1)
  const years = [start, start + 1, start + 2, start + 3]
  return (
    <div className="years">
      <button onClick={() => onChange(Math.max(2020, center - 1))} aria-label="Earlier year">‹</button>
      {allowAll && <button className={year === 'all' ? 'on' : ''} onClick={onAll}>All years</button>}
      {years.map((y) => <button key={y} className={y === year ? 'on' : ''} onClick={() => onChange(y)}>{y}</button>)}
      <button onClick={() => onChange(center + 1)} aria-label="Later year">›</button>
    </div>
  )
}

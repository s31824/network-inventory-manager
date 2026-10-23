import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, DEVICE_CATEGORIES, eur, kEur } from '../api.ts'
import type { CostsAll, CostsYear, Ownership } from '../api.ts'
import YearPicker from '../components/YearPicker.tsx'

// Validated chart colours (see mockups): replacement in reds, ownership in blue/green
const C = { hw: '#A3202B', inst: '#D98A2B', planned: '#A3202B', full: '#EBC7C9', lic: '#1F63A8', sup: '#1E9C7E' }
const num = (v: string | number | null | undefined) => Number(v ?? 0)
const n = (x: number) => x.toLocaleString('en-US').replace(/,/g, ' ')
const plural = (x: number, w: string) => `${n(x)} ${w}${x === 1 ? '' : 's'}`
const TOP = 8

function topN<T extends { label: string }>(rows: T[], value: (r: T) => number, merge: (rest: T[]) => T): T[] {
  const sorted = [...rows].sort((a, b) => value(b) - value(a))
  return sorted.length <= TOP ? sorted : [...sorted.slice(0, TOP - 1), merge(sorted.slice(TOP - 1))]
}

export default function CostsOverview() {
  const [year, setYear] = useState<number | 'all'>('all')
  const [country, setCountry] = useState('')
  const [category, setCategory] = useState('')

  // Country list comes from the unfiltered ownership breakdown (grouped by country)
  const { data: allCountries } = useQuery({ queryKey: ['costs', 'countries'], queryFn: () => api.costs<CostsAll>('all', '', '') })
  const countries = (allCountries?.ownership.by_group ?? []).map((g) => g.label).sort()
  const { data, isLoading, error } = useQuery({
    queryKey: ['costs', year, country, category],
    queryFn: () => api.costs<CostsAll | CostsYear>(year, country, category),
  })

  const chips: [string, () => void][] = [
    ...(country ? [[country, () => setCountry('')] as [string, () => void]] : []),
    ...(category ? [[category, () => setCategory('')] as [string, () => void]] : []),
  ]

  return (
    <>
      <div className="bar" style={{ justifyContent: 'space-between' }}>
        <YearPicker year={year} onChange={setYear} allowAll onAll={() => setYear('all')} />
        <span className="bar">
          <select className="input sel" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">Country: All</option>
            {countries.map((c) => <option key={c} value={c}>Country: {c}</option>)}
          </select>
          <select className="input sel" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Device type: All</option>
            {DEVICE_CATEGORIES.map((c) => <option key={c} value={c}>Device type: {c}</option>)}
          </select>
        </span>
      </div>
      {chips.length > 0 && (
        <div className="bar small">Active filters:
          {chips.map(([label, clear]) => <button key={label} className="pill" onClick={clear}>{label} ✕</button>)}
          <button className="link" onClick={() => { setCountry(''); setCategory('') }}>Clear all</button>
        </div>
      )}
      {isLoading || !data ? <div className="card empty">{error ? (error as Error).message : 'Loading…'}</div>
        : !data.report_month ? <div className="card empty">No inventory has been imported yet. Import a file in Settings.</div>
        : data.year === 'all' ? <AllYears d={data as CostsAll} country={country} />
        : <OneYear d={data as CostsYear} country={country} />}
    </>
  )
}

function Tile({ label, value, sub, hero, good, children }:
  { label: string; value: string; sub: string; hero?: boolean; good?: boolean; children?: React.ReactNode }) {
  return (
    <div className={`card tile${hero ? ' hero' : ''}`}>
      <div className="small"><b>{label}</b></div>
      <div className="v" style={good ? { color: 'var(--good)' } : undefined}>{value}</div>
      <div className="small">{sub}</div>
      {children}
    </div>
  )
}

function AllYears({ d, country }: { d: CostsAll; country: string }) {
  const r = d.replacement
  const years = r.years.map((y) => ({ ...y, hw: num(y.hardware), inst: num(y.installation), total: num(y.hardware) + num(y.installation) }))
  const span = `${years[0]?.year}–${years[years.length - 1]?.year}`
  const hw = years.reduce((s, y) => s + y.hw, 0), inst = years.reduce((s, y) => s + y.inst, 0)
  const devices = years.reduce((s, y) => s + y.devices, 0)
  return (
    <>
      <div className="tiles two-tiles">
        <Tile label={`Replacement cost · ${span}`} value={eur(r.total)}
          sub={`${plural(devices, 'device')} reach End of Support · hardware ${kEur(hw)} + installation ${kEur(inst)}`} />
        <OwnershipTile o={d.ownership} where={country || 'all countries'} />
      </div>
      <div className="c3">
        <div className="card pad">
          <div><b>Replacement cost by End of Support year</b><div className="small">{country || 'All countries'} · {span}</div></div>
          <Legend items={[['Hardware', C.hw], ['Installation', C.inst]]} />
          <ResponsiveContainer width="100%" height={460}>
            <BarChart data={years} margin={{ top: 24, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid vertical={false} stroke="#EFE7E0" />
              <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: '#E8DED6' }}
                tick={(p) => <YearTick {...p} row={years[p.index]} />} height={44} />
              <YAxis tickFormatter={kEur} tickLine={false} axisLine={false} width={56} tick={{ fontSize: 12, fill: '#8A7A73' }} />
              <Tooltip formatter={(v) => eur(Number(v))} cursor={{ fill: '#F7F1EC' }} />
              <Bar dataKey="hw" name="Hardware" stackId="a" fill={C.hw} maxBarSize={56} />
              <Bar dataKey="inst" name="Installation" stackId="a" fill={C.inst} maxBarSize={56} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="total" position="top" formatter={(v) => (Number(v) ? kEur(Number(v)) : '')}
                  style={{ fontSize: 13, fontWeight: 700, fill: '#2A1F1D' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ModelTable
          title={`Replacement cost by model · ${span}`} sub={`${country || 'All countries'} · sorted by total cost`}
          head={['Model', 'Type', 'EOS', 'Devices', 'Per device', 'Total']}
          rows={r.by_model.map((m) => [m.model, m.category, String(m.eos_year), n(m.devices),
            m.unit_cost === null ? 'no price' : eur(m.unit_cost), num(m.total) ? eur(m.total) : '—'])}
        />
        <OwnershipChart o={d.ownership} by={d.group_by} country={country} />
      </div>
    </>
  )
}

function OneYear({ d, country }: { d: CostsYear; country: string }) {
  const p = d.plan, t = p.tiles, c = p.devices
  const planned = num(t.planned), full = num(t.full)
  const groups = topN(p.by_group.map((g) => ({ label: g.label, full: num(g.full), planned: num(g.planned) })),
    (g) => g.full, (rest) => ({ label: `Other ${rest.length}`, full: rest.reduce((s, g) => s + g.full, 0),
      planned: rest.reduce((s, g) => s + g.planned, 0) }))
  return (
    <>
      <div className="tiles">
        <Tile hero label={`Already planned · ${d.year}`} value={eur(planned)}
          sub={`${plural(c.planned, 'device')} · of ${eur(full)} full End of Support cost`}>
          <div className="meter"><i style={{ width: `${full ? (planned / full) * 100 : 0}%` }} /></div>
        </Tile>
        <Tile label="Not planned yet" value={eur(t.not_planned)}
          sub={`${plural(c.not_planned, 'device')} reach End of Support without a plan`} />
        <Tile good label="Avoided by decommission" value={eur(t.avoided)}
          sub={`${plural(c.avoided, 'device')} will be removed, not replaced`} />
        <OwnershipTile o={d.ownership} where={country || 'all countries'} />
      </div>
      <div className="c3">
        <div className="card pad">
          <div><b>Replacement plan {d.year} by {d.group_by}</b>
            <div className="small">{country || 'All countries'} · End of Support in {d.year} · decommission savings not deducted</div></div>
          <Legend items={[['Already planned for this year', C.planned], ['Full End of Support cost', C.full]]} />
          <ResponsiveContainer width="100%" height={460}>
            <BarChart data={groups.map((g) => ({ ...g, rest: Math.max(0, g.full - g.planned) }))}
              margin={{ top: 24, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid vertical={false} stroke="#EFE7E0" />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#E8DED6' }} interval={0}
                tick={(pp) => <GroupTick {...pp} row={groups[pp.index]} />} height={44} />
              <YAxis tickFormatter={kEur} tickLine={false} axisLine={false} width={56} tick={{ fontSize: 12, fill: '#8A7A73' }} />
              <Tooltip formatter={(v, name) => [eur(Number(v)), name]} cursor={{ fill: '#F7F1EC' }} />
              {/* One bar per group: planned part at the bottom, the rest of the full EOS cost on top */}
              <Bar dataKey="planned" name="Already planned" stackId="eos" fill={C.planned} maxBarSize={56} />
              <Bar dataKey="rest" name="Not yet planned" stackId="eos" fill={C.full} maxBarSize={56} radius={[4, 4, 0, 0]}>
                <LabelList dataKey="full" position="top" formatter={(v) => (Number(v) ? kEur(Number(v)) : '')}
                  style={{ fontSize: 12, fontWeight: 700, fill: '#2A1F1D' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ModelTable
          title={`Planned cost by model · ${country ? country + ' · ' : ''}${d.year}`}
          sub="Planned = any status except Not planned, Decommission, Exception and Out of scope"
          head={['Model', 'Type', 'Devices', 'Planned', 'Decom.', 'Per device', 'Planned cost']}
          rows={p.by_model.map((m) => [m.model, m.category, n(m.devices), n(m.planned), m.decommission ? n(m.decommission) : '—',
            m.unit_cost === null ? 'no price' : eur(m.unit_cost), num(m.planned_cost) ? eur(m.planned_cost) : '—'])}
        />
        <OwnershipChart o={d.ownership} by={d.group_by} country={country} />
      </div>
    </>
  )
}

function OwnershipTile({ o, where }: { o: Ownership; where: string }) {
  return <Tile label="Ownership cost per year" value={eur(o.total)}
    sub={`${n(o.devices)} devices in ${where} · licences ${kEur(num(o.licences))} + support ${kEur(num(o.support))}`} />
}

function OwnershipChart({ o, by, country }: { o: Ownership; by: string; country: string }) {
  const rows = topN(o.by_group.map((g) => ({ label: g.label, lic: num(g.licences), sup: num(g.support) })),
    (r) => r.lic + r.sup, (rest) => ({ label: `Other ${rest.length}`, lic: rest.reduce((s, r) => s + r.lic, 0),
      sup: rest.reduce((s, r) => s + r.sup, 0) })).map((r) => ({ ...r, total: r.lic + r.sup }))
  return (
    <div className="card pad">
      <div><b>Ownership cost per year by {by}</b><div className="small">{country || 'All countries'} · all devices in the current inventory</div></div>
      <Legend items={[['Licences', C.lic], ['Support', C.sup]]} />
      {rows.length === 0 ? <div className="empty">No prices for these models yet.</div> : (
        <ResponsiveContainer width="100%" height={460}>
          <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 64, left: 8, bottom: 8 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="label" width={96} tickLine={false} axisLine={false} tick={{ fontSize: 13, fill: '#2A1F1D' }} />
            <Tooltip formatter={(v) => eur(Number(v))} cursor={{ fill: '#F7F1EC' }} />
            <Bar dataKey="lic" name="Licences" stackId="o" fill={C.lic} maxBarSize={24} />
            <Bar dataKey="sup" name="Support" stackId="o" fill={C.sup} maxBarSize={24} radius={[0, 4, 4, 0]}>
              <LabelList dataKey="total" position="right" formatter={(v) => kEur(Number(v))}
                style={{ fontSize: 13, fontWeight: 600, fill: '#2A1F1D' }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function ModelTable({ title, sub, head, rows }: { title: string; sub: string; head: string[]; rows: string[][] }) {
  const [page, setPage] = useState(0)
  const size = 11, pages = Math.max(1, Math.ceil(rows.length / size)), cur = Math.min(page, pages - 1)
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="pad" style={{ paddingBottom: 8 }}><div><b>{title}</b><div className="small">{sub}</div></div></div>
      <div style={{ flex: 1, overflowX: 'auto' }}>
        <table>
          <thead><tr>{head.map((h, i) => <th key={h} className={i >= head.length - 3 || h === 'Devices' ? 'num' : ''}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={head.length} className="empty">Nothing reaches End of Support in this selection.</td></tr>}
            {rows.slice(cur * size, cur * size + size).map((r) => (
              <tr key={r[0]}>
                {r.map((cell, i) => (
                  <td key={i} className={i === 0 ? 'mono' : i >= head.length - 3 || head[i] === 'Devices' ? 'num' : ''}
                    style={i === 0 || i === r.length - 1 ? { fontWeight: 700 } : undefined}>
                    {i === 1 ? <span className="tag">{cell}</span> : cell === 'no price' ? <span className="small">no price</span> : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="foot">
        <span>{rows.length ? `${cur * size + 1}–${Math.min(rows.length, (cur + 1) * size)} of ${rows.length} models` : '0 models'}</span>
        <span className="bar">
          <button className="btn" disabled={cur === 0} onClick={() => setPage(cur - 1)}>Previous</button>
          <button className="btn" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Next</button>
        </span>
      </div>
    </div>
  )
}

function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="legend">
      {items.map(([label, color]) => <span key={label}><i style={{ background: color }} />{label}</span>)}
    </div>
  )
}

type TickProps = { x?: number | string; y?: number | string; payload?: { value: string | number } }
function YearTick({ x, y, payload, row }: TickProps & { row?: { devices: number; without_price: number } }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <text dy={14} textAnchor="middle" fontSize={13} fontWeight={600} fill="#2A1F1D">{payload?.value}</text>
      <text dy={30} textAnchor="middle" fontSize={11} fill={row?.without_price ? '#9C1A25' : '#8A7A73'}>
        {row ? (row.without_price ? `${row.without_price} no price` : `${row.devices} dev.`) : ''}
      </text>
    </g>
  )
}
function GroupTick({ x, y, payload, row }: TickProps & { row?: { planned: number } }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <text dy={14} textAnchor="middle" fontSize={12} fontWeight={600} fill="#2A1F1D">{payload?.value}</text>
      <text dy={30} textAnchor="middle" fontSize={11} fontWeight={600} fill="#8A1C25">{row?.planned ? kEur(row.planned) : '—'}</text>
    </g>
  )
}

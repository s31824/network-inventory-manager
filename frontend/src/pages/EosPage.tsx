import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, eur, LOCATION_STATUSES } from '../api.ts'
import type { EosLocation, EosModelLine } from '../api.ts'
import YearPicker from '../components/YearPicker.tsx'

export const STATUS_COLOR: Record<string, string> = {
  'Not planned': '#CBBFB6', Next: '#D9541E', 'To ship': '#A65A16', 'In progress': '#2F5E8C',
  'On hold': '#E0A21F', Exception: '#7A1424', Decommission: '#8A7F79', 'Out of scope': '#2A1F1D', Done: '#3D7A6A',
}
const NO_MONTH = new Set(['Not planned', 'Out of scope'])
const CITIES_PER_PAGE = 20
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const fmtDate = (d: string | null) =>
  d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—'

export default function EosPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [status, setStatus] = useState('')
  const [model, setModel] = useState('')
  const [query, setQuery] = useState('')
  const [openCities, setOpenCities] = useState<Set<string>>(new Set())
  const [openLocs, setOpenLocs] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(0)

  const { data, isLoading, error } = useQuery({ queryKey: ['eos', year], queryFn: () => api.eos(year) })
  const { data: prices = [] } = useQuery({ queryKey: ['model-costs'], queryFn: api.listModelCosts })
  const all = useMemo(() => data?.locations ?? [], [data])

  const countries = useMemo(() => [...new Set(all.map((l) => l.country))].sort(), [all])
  const cities = useMemo(() => [...new Set(all.filter((l) => !country || l.country === country).map((l) => l.city))].sort(),
    [all, country])

  // Locations matching the filters (status, country, city, search) – used for the model cards
  const base = useMemo(() => all.filter((l) =>
    (!country || l.country === country) && (!city || l.city === city) && (!status || l.status === status) &&
    (!query || l.code.toLowerCase().includes(query.trim().toLowerCase()))), [all, country, city, status, query])
  const modelCards = useMemo(() => {
    const m = new Map<string, { devices: number; eos: string | null }>()
    base.forEach((l) => l.models.forEach((x) => {
      const cur = m.get(x.model) ?? { devices: 0, eos: x.eos_date }
      m.set(x.model, { devices: cur.devices + x.devices, eos: cur.eos })
    }))
    return [...m].sort((a, b) => b[1].devices - a[1].devices)
  }, [base])
  const visibleLocs = model ? base.filter((l) => l.models.some((x) => x.model === model)) : base
  const devices = visibleLocs.reduce((s, l) => s + l.models.filter((x) => !model || x.model === model)
    .reduce((t, x) => t + x.devices, 0), 0)

  const byCity = useMemo(() => {
    const g = new Map<string, EosLocation[]>()
    visibleLocs.forEach((l) => { const k = `${l.country} › ${l.city}`; g.set(k, [...(g.get(k) ?? []), l]) })
    return [...g].sort((a, b) => a[0].localeCompare(b[0]))
  }, [visibleLocs])
  const pages = Math.max(1, Math.ceil(byCity.length / CITIES_PER_PAGE))
  const current = Math.min(page, pages - 1)
  const pageCities = byCity.slice(current * CITIES_PER_PAGE, (current + 1) * CITIES_PER_PAGE)

  const toggle = (set: Set<string>, key: string, update: (s: Set<string>) => void) => {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    update(next)
  }
  const resetPage = () => setPage(0)
  const filters: [string, string, () => void][] = [
    ...(country ? [[country, 'country', () => { setCountry(''); setCity('') }] as [string, string, () => void]] : []),
    ...(city ? [[city, 'city', () => setCity('')] as [string, string, () => void]] : []),
    ...(status ? [[status, 'status', () => setStatus('')] as [string, string, () => void]] : []),
    ...(model ? [[model, 'model', () => setModel('')] as [string, string, () => void]] : []),
  ]

  return (
    <>
      <div className="head">
        <div>
          <h1>End of Support</h1>
          <p className="sub">
            {[country, city].filter(Boolean).join(' › ') || 'All countries'} · {devices.toLocaleString('en-US').replace(/,/g, ' ')} devices
            in {visibleLocs.length} locations reach End of Support in {year}
          </p>
        </div>
        <YearPicker year={year} onChange={(y) => { setYear(y); setModel(''); resetPage() }} />
      </div>

      <div className="bar">
        <select className="input sel" value={country} onChange={(e) => { setCountry(e.target.value); setCity(''); resetPage() }}>
          <option value="">Country: All</option>
          {countries.map((c) => <option key={c} value={c}>Country: {c}</option>)}
        </select>
        <select className="input sel" value={city} onChange={(e) => { setCity(e.target.value); resetPage() }}>
          <option value="">City: All</option>
          {cities.map((c) => <option key={c} value={c}>City: {c}</option>)}
        </select>
        <select className="input sel" value={status} onChange={(e) => { setStatus(e.target.value); resetPage() }}>
          <option value="">Status: All</option>
          {LOCATION_STATUSES.map((s) => <option key={s} value={s}>Status: {s}</option>)}
        </select>
        <input className="input search" type="search" placeholder="Find location code" value={query}
          onChange={(e) => { setQuery(e.target.value); resetPage() }} />
      </div>

      {filters.length > 0 && (
        <div className="bar small">
          Active filters:
          {filters.map(([label, key, clear]) => (
            <button key={key} className="pill" onClick={() => { clear(); resetPage() }}>{label} ✕</button>
          ))}
          <button className="link" onClick={() => { setCountry(''); setCity(''); setStatus(''); setModel(''); setQuery(''); resetPage() }}>
            Clear all
          </button>
        </div>
      )}

      <div className="card pad" style={{ gap: 10 }}>
        <div className="bar" style={{ justifyContent: 'space-between' }}>
          <b>Models reaching End of Support</b><span className="small">Click a model to filter</span>
        </div>
        <div className="models">
          {modelCards.length === 0 && <span className="small">No models reach End of Support in {year} for this selection.</span>}
          {modelCards.map(([m, v]) => (
            <button key={m} className={`model${model === m ? ' on' : ''}`} onClick={() => { setModel(model === m ? '' : m); resetPage() }}>
              <span className="mono"><b>{m}</b></span>
              <span className="n">{v.devices}</span>
              <span className="small">EOS {fmtDate(v.eos)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <span className="small">Showing <b>{byCity.length} cities</b> · {visibleLocs.length} locations</span>
          <span className="bar">
            <button className="link" onClick={() => setOpenCities(new Set(pageCities.map(([k]) => k)))}>Expand all</button>
            <button className="link" onClick={() => setOpenCities(new Set())}>Collapse all</button>
          </span>
        </div>
        {isLoading ? <div className="empty">Loading…</div> : error ? (
          <div className="empty">Could not load: {(error as Error).message}</div>
        ) : all.length === 0 ? (
          <div className="empty">Nothing reaches End of Support in {year}, or no inventory has been imported yet.</div>
        ) : (
          <div>
            {pageCities.map(([key, locs]) => {
              const open = openCities.has(key)
              return (
                <div key={key}>
                  <button className="city" onClick={() => toggle(openCities, key, setOpenCities)}>
                    <span className="chev">{open ? '▾' : '▸'}</span>
                    <b>{key}</b>
                    <span className="small">{plural(locs.length, 'location')} · {plural(locs.reduce((s, l) => s + l.devices, 0), 'device')}</span>
                  </button>
                  {open && (
                    <>
                      <div className="loc head-row">
                        <span /><span>Location</span><span>Models reaching End of Support</span>
                        <span className="num">Devices</span><span>Location status</span><span>Planned</span>
                      </div>
                      {locs.map((l) => (
                        <LocationRow key={l.code} year={year} loc={l} open={openLocs.has(l.code)}
                          onToggle={() => toggle(openLocs, l.code, setOpenLocs)}
                          replacementOptions={prices.map((p) => p.model)} />
                      ))}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
        <div className="foot">
          <span>{byCity.length ? `${current * CITIES_PER_PAGE + 1}–${Math.min(byCity.length, (current + 1) * CITIES_PER_PAGE)} of ${byCity.length} cities · click a city to show its locations` : '0 cities'}</span>
          <span className="bar">
            <button className="btn" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
            <button className="btn" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</button>
          </span>
        </div>
      </div>
    </>
  )
}

function LocationRow({ year, loc, open, onToggle, replacementOptions }:
  { year: number; loc: EosLocation; open: boolean; onToggle: () => void; replacementOptions: string[] }) {
  const queryClient = useQueryClient()
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ['eos', year] }); queryClient.invalidateQueries({ queryKey: ['costs'] }) }
  const savePlan = useMutation({
    mutationFn: (d: { status: string; planned_month: string | null }) => api.setLocationPlan(year, loc.code, d),
    onSuccess: refresh,
  })
  const needsMonth = !NO_MONTH.has(loc.status)

  return (
    <>
      <div className={`loc${open ? ' open' : ''}`}>
        <button className="chev link" onClick={onToggle} aria-label={open ? 'Collapse' : 'Expand'}>{open ? '▾' : '▸'}</button>
        <span className="mono code">{loc.code}</span>
        <span>{loc.models.map((m) => <span key={m.model} className="tag mono">{m.model} × {m.devices}</span>)}</span>
        <span className="num"><b>{loc.devices}</b></span>
        <span className="bar" style={{ gap: 8 }}>
          <i className="dot" style={{ background: STATUS_COLOR[loc.status] }} />
          <select className="plain" value={loc.status} disabled={savePlan.isPending}
            onChange={(e) => savePlan.mutate({ status: e.target.value, planned_month: NO_MONTH.has(e.target.value) ? null : loc.planned_month })}>
            {LOCATION_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </span>
        <span>
          {needsMonth ? (
            <input className="plain" type="month" value={loc.planned_month ?? ''}
              onChange={(e) => savePlan.mutate({ status: loc.status, planned_month: e.target.value || null })} />
          ) : <span className="small">—</span>}
        </span>
      </div>
      {open && (
        <div className="exp">
          <table>
            <thead>
              <tr><th>Model</th><th>Type</th><th>End of Support</th><th className="num">Devices</th>
                <th>Replacement model</th><th className="num">Decommission</th><th className="num">To replace</th>
                <th className="num">Replacement cost</th></tr>
            </thead>
            <tbody>
              {loc.models.map((m) => (
                <ModelRow key={m.model} year={year} code={loc.code} line={m} options={replacementOptions} onSaved={refresh} />
              ))}
            </tbody>
          </table>
          <p className="small" style={{ margin: '8px 0 0' }}>
            Replacement defaults to the price list. Done is confirmed when a later import shows the old model gone.
          </p>
        </div>
      )}
    </>
  )
}

function ModelRow({ year, code, line, options, onSaved }:
  { year: number; code: string; line: EosModelLine; options: string[]; onSaved: () => void }) {
  const save = useMutation({
    mutationFn: (d: { decommission_count: number; replacement_model: string | null }) =>
      api.setModelPlan(year, code, line.model, d),
    onSuccess: onSaved,
  })
  const override = line.replacement_is_default ? null : line.replacement_model
  const setDecom = (n: number) => save.mutate({ decommission_count: Math.max(0, Math.min(line.devices, n)), replacement_model: override })

  return (
    <tr>
      <td className="mono" style={{ fontWeight: 600 }}>{line.model}</td>
      <td><span className="tag">{line.category}</span></td>
      <td>{fmtDate(line.eos_date)}</td>
      <td className="num"><b>{line.devices}</b></td>
      <td>
        <select className="input" style={{ height: 36, width: 230 }} value={override ?? ''} disabled={save.isPending}
          onChange={(e) => save.mutate({ decommission_count: line.decommission, replacement_model: e.target.value || null })}>
          <option value="">{line.replacement_is_default && line.replacement_model ? `${line.replacement_model} (price list)` : 'From price list'}</option>
          {options.filter((o) => o !== line.model).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </td>
      <td className="num">
        <span className="step">
          <button onClick={() => setDecom(line.decommission - 1)} disabled={save.isPending || line.decommission === 0}>−</button>
          <b>{line.decommission}</b>
          <button onClick={() => setDecom(line.decommission + 1)} disabled={save.isPending || line.decommission >= line.devices}>+</button>
        </span>
      </td>
      <td className="num"><b>{line.to_replace}</b></td>
      <td className="num">{line.replacement_cost === null ? <span className="small">no price</span> : eur(line.replacement_cost)}</td>
    </tr>
  )
}

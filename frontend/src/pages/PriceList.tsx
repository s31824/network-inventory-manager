import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, eur } from '../api.ts'
import type { ModelCost } from '../api.ts'
import ModelDrawer from '../components/ModelDrawer.tsx'

const PAGE_SIZE = 15

export default function PriceList() {
  const { data = [], isLoading, error } = useQuery({ queryKey: ['model-costs'], queryFn: api.listModelCosts })
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<ModelCost | 'new' | null>(null)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? data.filter((m) => m.model.toLowerCase().includes(q)) : data
  }, [data, query])
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const visible = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE)

  return (
    <>
      <div className="bar">
        <input
          className="input search"
          type="search"
          placeholder="Search model"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(0) }}
        />
        <button className="btn primary" onClick={() => setEditing('new')}>+ Add model</button>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="empty">Loading…</div>
        ) : error ? (
          <div className="empty">Could not load the price list: {(error as Error).message}</div>
        ) : rows.length === 0 ? (
          <div className="empty">{data.length ? 'No models match.' : 'The price list is empty. Add the first model.'}</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Model</th><th>Type</th>
                <th className="num">Hardware price</th><th className="num">Installation</th>
                <th className="num">Licence / year</th><th className="num">Support / year</th>
                <th className="num">Ownership / year</th><th>Suggested replacement</th><th />
              </tr>
            </thead>
            <tbody>
              {visible.map((m) => (
                <tr key={m.id}>
                  <td className="mono" style={{ fontWeight: 600 }}>{m.model}</td>
                  <td>{m.device_type ? <span className="tag">{m.device_type}</span> : '—'}</td>
                  <td className="num">{eur(m.hardware_price)}</td>
                  <td className="num">{eur(m.installation_cost)}</td>
                  <td className="num">{eur(m.licence_per_year)}</td>
                  <td className="num">{eur(m.support_per_year)}</td>
                  <td className="num"><b>{eur(m.ownership_per_year)}</b></td>
                  <td className="mono">{m.replacement_model ?? '—'}</td>
                  <td className="num"><button className="link" onClick={() => setEditing(m)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="foot">
          <span>
            {rows.length ? `${current * PAGE_SIZE + 1}–${Math.min(rows.length, (current + 1) * PAGE_SIZE)} of ${rows.length} models` : '0 models'}
            {' · each row holds the costs of that model'}
          </span>
          <span className="bar">
            <button className="btn" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
            <button className="btn" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Next</button>
          </span>
        </div>
      </div>

      {editing && (
        <ModelDrawer
          model={editing === 'new' ? null : editing}
          allModels={data.map((m) => m.model)}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

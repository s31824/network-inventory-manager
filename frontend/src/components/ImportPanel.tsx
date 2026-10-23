import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { readSheet } from 'read-excel-file/browser'
import { api, ApiError } from '../api.ts'
import { monthFromFileName, parseInventory } from '../import/parseInventory.ts'
import type { ParsedInventory } from '../import/parseInventory.ts'

const MAX_FILE_MB = 20
const n = (x: number) => x.toLocaleString('en-US').replace(/,/g, ' ')

export default function ImportPanel() {
  const queryClient = useQueryClient()
  const [fileName, setFileName] = useState('')
  const [month, setMonth] = useState('')
  const [parsed, setParsed] = useState<ParsedInventory | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const reset = () => { setFileName(''); setParsed(null); setParseError(null); setMonth('') }

  async function onFile(file: File | undefined) {
    reset(); setDone(null)
    if (!file) return
    if (file.size > MAX_FILE_MB * 1024 * 1024) { setParseError(`The file is larger than ${MAX_FILE_MB} MB.`); return }
    setFileName(file.name)
    setMonth(monthFromFileName(file.name) ?? '')
    setReading(true)
    try {
      const sheet = await readSheet(file)          // read locally in the browser
      setParsed(parseInventory(sheet as unknown[][]))
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'The file could not be read.')
    } finally {
      setReading(false)
    }
  }

  const send = useMutation({
    mutationFn: (replace: boolean) => api.createImport({
      report_month: month, file_name: fileName, rows_read: parsed!.rowsRead, replace,
      locations: parsed!.locations, device_counts: parsed!.deviceCounts,
    }),
    onSuccess: (r) => {
      queryClient.invalidateQueries()
      setDone(`${r.report_month} imported: ${n(r.device_count)} devices.`)
      reset()
    },
  })
  const conflict = send.error instanceof ApiError && send.error.status === 409

  const countries = parsed ? new Set(parsed.locations.map((l) => l.country)).size : 0

  return (
    <div className="card">
      <div className="card-h"><h2>Import inventory</h2>
        <span className="small">The Excel file is read in your browser. Only aggregated numbers are sent to the server.</span></div>
      <div className="pad">
        <div className="bar">
          <label className="btn primary" style={{ display: 'inline-flex', alignItems: 'center' }}>
            Choose .xlsx file
            <input type="file" accept=".xlsx" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
          </label>
          {fileName && <span className="mono">{fileName}</span>}
          {reading && <span className="small">Reading…</span>}
        </div>

        {done && <div className="ok">{done}</div>}
        {parseError && <div className="error">{parseError}</div>}

        {parsed && (
          <>
            <div className="stats">
              <div><b>{n(parsed.rowsRead)}</b><span>rows read</span></div>
              <div><b>{n(parsed.devices)}</b><span>devices</span></div>
              <div><b>{n(parsed.locations.length)}</b><span>locations</span></div>
              <div><b>{countries}</b><span>countries</span></div>
              <div><b>{n(parsed.noEosDate)}</b><span>without EOS date</span></div>
            </div>
            {parsed.skipped.map((s) => <div key={s.reason} className="warn">{n(s.count)} rows skipped: {s.reason}</div>)}
            {parsed.warnings.map((w) => <div key={w} className="warn">{w}</div>)}
            <p className="small">
              Sent to the server: location code, city, country, location category, model, device type,
              End of Support date and number of devices. Not sent: hostnames, serial numbers, IP addresses,
              street addresses, Meraki networks, contracts.
            </p>
            <div className="bar">
              <div className="field" style={{ width: 200 }}>
                <label htmlFor="imp-month">Inventory month *</label>
                <input id="imp-month" className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
              </div>
              <span style={{ flex: 1 }} />
              <button className="btn" onClick={reset}>Cancel</button>
              {conflict ? (
                <button className="btn primary" disabled={send.isPending} onClick={() => send.mutate(true)}>
                  Replace {month}
                </button>
              ) : (
                <button className="btn primary" disabled={!month || send.isPending} onClick={() => send.mutate(false)}>
                  {send.isPending ? 'Importing…' : 'Import'}
                </button>
              )}
            </div>
            {send.error && (conflict
              ? <div className="warn">{month} is already imported. Click “Replace {month}” to overwrite it with this file.</div>
              : <div className="error">{send.error.message}</div>)}
          </>
        )}
      </div>
    </div>
  )
}

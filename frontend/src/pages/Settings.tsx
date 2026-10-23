import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api.ts'
import ImportPanel from '../components/ImportPanel.tsx'

export default function Settings() {
  const queryClient = useQueryClient()
  const { data: imports = [], isLoading } = useQuery({ queryKey: ['imports'], queryFn: api.listImports })
  const remove = useMutation({
    mutationFn: api.deleteImport,
    onSuccess: () => queryClient.invalidateQueries(),
  })

  return (
    <>
      <div className="head">
        <div>
          <h1>Settings</h1>
          <p className="sub">Monthly inventory imports</p>
        </div>
      </div>

      <ImportPanel />

      <div className="card">
        <div className="card-h"><h2>Imported months</h2><span className="small">The newest month is used for EOS and Costs</span></div>
        {isLoading ? <div className="empty">Loading…</div> : imports.length === 0 ? (
          <div className="empty">No inventory has been imported yet.</div>
        ) : (
          <table>
            <thead><tr><th>Month</th><th>File</th><th>Imported</th><th className="num">Devices</th><th /></tr></thead>
            <tbody>
              {imports.map((i, n) => (
                <tr key={i.id}>
                  <td><b>{i.report_month}</b>{n === 0 && <span className="tag" style={{ marginLeft: 8 }}>current</span>}</td>
                  <td className="mono">{i.file_name}</td>
                  <td>{new Date(i.imported_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td className="num">{i.device_count.toLocaleString('en-US').replace(/,/g, ' ')}</td>
                  <td className="num">
                    <button className="link" disabled={remove.isPending}
                      onClick={() => { if (confirm(`Delete the ${i.report_month} import?`)) remove.mutate(i.report_month) }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

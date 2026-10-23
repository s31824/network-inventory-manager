// Small typed wrapper around the backend API (served on /api, proxied by Vite in development).

export type ModelCost = {
  id: number
  model: string
  vendor: string | null
  device_type: string | null
  hardware_price: string | null
  installation_cost: string | null
  licence_per_year: string | null
  support_per_year: string | null
  replacement_model: string | null
  currency: string
  price_date: string | null
  notes: string | null
  ownership_per_year: string
}

export type ModelCostInput = Omit<ModelCost, 'id' | 'ownership_per_year'>

export type ImportRecord = {
  id: number
  report_month: string
  file_name: string
  imported_at: string
  rows_read: number
  device_count: number
}

export type ImportPayload = {
  report_month: string
  file_name: string
  rows_read: number
  replace: boolean
  locations: { code: string; city: string; country: string; category: string | null }[]
  device_counts: { location_code: string; model: string; device_type: string; eos_date: string | null; count: number }[]
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (typeof body.detail === 'string') message = body.detail
      else if (Array.isArray(body.detail)) {
        message = body.detail
          .map((d: { loc?: string[]; msg: string }) => `${d.loc?.slice(1).join('.') ?? ''}: ${d.msg}`)
          .join('; ')
      }
    } catch {
      /* keep the generic message */
    }
    throw new ApiError(message, res.status)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

export const api = {
  listModelCosts: () => request<ModelCost[]>('/api/model-costs'),
  createModelCost: (data: ModelCostInput) =>
    request<ModelCost>('/api/model-costs', { method: 'POST', body: JSON.stringify(data) }),
  updateModelCost: (model: string, data: ModelCostInput) =>
    request<ModelCost>(`/api/model-costs/${encodeURIComponent(model)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteModelCost: (model: string) =>
    request<void>(`/api/model-costs/${encodeURIComponent(model)}`, { method: 'DELETE' }),
  listImports: () => request<ImportRecord[]>('/api/imports'),
  createImport: (data: ImportPayload) =>
    request<ImportRecord>('/api/imports', { method: 'POST', body: JSON.stringify(data) }),
  deleteImport: (month: string) =>
    request<void>(`/api/imports/${encodeURIComponent(month)}`, { method: 'DELETE' }),
}

export function eur(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  return '€' + Math.round(n).toLocaleString('en-US').replace(/,/g, ' ')
}

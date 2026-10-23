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

export type EosModelLine = {
  model: string
  device_type: string
  category: string
  eos_date: string | null
  devices: number
  decommission: number
  to_replace: number
  replacement_model: string | null
  replacement_is_default: boolean
  replacement_unit_cost: string | null
  replacement_cost: string | null
}
export type EosLocation = {
  code: string
  city: string
  country: string
  category: string | null
  status: string
  planned_month: string | null
  devices: number
  models: EosModelLine[]
}
export type EosOverview = {
  year: number
  devices: number
  locations: EosLocation[]
  models_reaching_eos: Record<string, number>
}

export const LOCATION_STATUSES = ['Not planned', 'Next', 'To ship', 'In progress', 'On hold',
  'Exception', 'Decommission', 'Out of scope', 'Done'] as const

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
  eos: (year: number) => request<EosOverview>(`/api/eos?year=${year}`),
  setLocationPlan: (year: number, code: string, data: { status: string; planned_month: string | null }) =>
    request(`/api/eos/${year}/locations/${encodeURIComponent(code)}`, { method: 'PUT', body: JSON.stringify(data) }),
  setModelPlan: (year: number, code: string, model: string,
    data: { decommission_count: number; replacement_model: string | null }) =>
    request(`/api/eos/${year}/locations/${encodeURIComponent(code)}/models/${encodeURIComponent(model)}`,
      { method: 'PUT', body: JSON.stringify(data) }),
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

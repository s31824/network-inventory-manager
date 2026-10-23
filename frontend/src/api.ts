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

export class ApiError extends Error {}

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
    throw new ApiError(message)
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
}

export function eur(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  const n = Number(value)
  return '€' + Math.round(n).toLocaleString('en-US').replace(/,/g, ' ')
}

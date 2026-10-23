import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, eur } from '../api.ts'
import type { ModelCost, ModelCostInput } from '../api.ts'

const TYPES = ['Access point', 'Switch', 'Router', 'Data center', 'Other']
const CURRENCIES = ['EUR', 'SEK', 'DKK', 'NOK', 'USD', 'GBP', 'PLN']

type Props = { model: ModelCost | null; allModels: string[]; onClose: () => void }

const emptyForm: ModelCostInput = {
  model: '', vendor: null, device_type: 'Access point', hardware_price: null, installation_cost: null,
  licence_per_year: null, support_per_year: null, replacement_model: null, currency: 'EUR',
  price_date: null, notes: null,
}

export default function ModelDrawer({ model, allModels, onClose }: Props) {
  const isNew = model === null
  const [form, setForm] = useState<ModelCostInput>(model ? { ...model } : emptyForm)
  const queryClient = useQueryClient()

  const set = <K extends keyof ModelCostInput>(key: K, value: ModelCostInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))
  const money = (key: 'hardware_price' | 'installation_cost' | 'licence_per_year' | 'support_per_year') => ({
    value: form[key] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, e.target.value === '' ? null : e.target.value),
  })

  const done = () => {
    queryClient.invalidateQueries({ queryKey: ['model-costs'] })
    onClose()
  }
  const save = useMutation({
    mutationFn: () => {
      // The model name cannot change on edit; the backend ignores it in updates.
      return isNew ? api.createModelCost(form) : api.updateModelCost(model.model, form)
    },
    onSuccess: done,
  })
  const remove = useMutation({ mutationFn: () => api.deleteModelCost(model!.model), onSuccess: done })
  const error = (save.error ?? remove.error) as Error | null

  const ownership = Number(form.licence_per_year ?? 0) + Number(form.support_per_year ?? 0)

  return (
    <>
      <div className="shade" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header>
          <h2 id="drawer-title">{isNew ? 'Add model' : `Edit ${model.model}`}</h2>
          <button className="x" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <form className="body" id="model-form" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
          {error && <div className="error">{error.message}</div>}
          <div className="field">
            <label htmlFor="m-model">Model *</label>
            <input id="m-model" className="input mono" required maxLength={100} disabled={!isNew}
              value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="e.g. CW9162I" />
          </div>
          <div className="two">
            <div className="field">
              <label htmlFor="m-type">Device type</label>
              <select id="m-type" className="input" value={form.device_type ?? ''}
                onChange={(e) => set('device_type', e.target.value || null)}>
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="m-vendor">Vendor</label>
              <input id="m-vendor" className="input" maxLength={100} value={form.vendor ?? ''}
                onChange={(e) => set('vendor', e.target.value || null)} placeholder="e.g. Meraki" />
            </div>
          </div>
          <div className="two">
            <div className="field"><label htmlFor="m-hw">Hardware price</label>
              <input id="m-hw" className="input" type="number" min="0" step="0.01" {...money('hardware_price')} /></div>
            <div className="field"><label htmlFor="m-inst">Installation cost</label>
              <input id="m-inst" className="input" type="number" min="0" step="0.01" {...money('installation_cost')} /></div>
          </div>
          <div className="two">
            <div className="field"><label htmlFor="m-lic">Licence cost / year</label>
              <input id="m-lic" className="input" type="number" min="0" step="0.01" {...money('licence_per_year')} /></div>
            <div className="field"><label htmlFor="m-sup">Support cost / year</label>
              <input id="m-sup" className="input" type="number" min="0" step="0.01" {...money('support_per_year')} /></div>
          </div>
          <div className="field">
            <label htmlFor="m-repl">Suggested replacement</label>
            <select id="m-repl" className="input" value={form.replacement_model ?? ''}
              onChange={(e) => set('replacement_model', e.target.value || null)}>
              <option value="">None · model is not reaching End of Support</option>
              {allModels.filter((m) => m !== form.model).map((m) => <option key={m}>{m}</option>)}
            </select>
            <span className="hint">The replacement model's own prices are used for the replacement cost.</span>
          </div>
          <div className="two">
            <div className="field"><label htmlFor="m-cur">Currency</label>
              <select id="m-cur" className="input" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select></div>
            <div className="field"><label htmlFor="m-date">Price date</label>
              <input id="m-date" className="input" type="month" value={form.price_date ?? ''}
                onChange={(e) => set('price_date', e.target.value || null)} /></div>
          </div>
          <div className="total"><span className="small">Ownership per device / year</span><b>{eur(ownership)}</b></div>
        </form>
        <footer>
          {!isNew && (
            <button className="btn danger" disabled={remove.isPending}
              onClick={() => { if (confirm(`Delete ${model.model} from the price list?`)) remove.mutate() }}>
              Delete
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" type="submit" form="model-form" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save model'}
          </button>
        </footer>
      </aside>
    </>
  )
}

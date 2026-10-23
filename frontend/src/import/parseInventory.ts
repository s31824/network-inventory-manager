// Turns the rows of an inventory Excel sheet into the aggregated numbers the API accepts.
// Runs in the browser: the file itself never leaves the user's computer. Only codes, cities,
// countries, categories, models, device types, End of Support dates and counts are kept.

export type ImportLocation = { code: string; city: string; country: string; category: string | null }
export type ImportDeviceCount = {
  location_code: string
  model: string
  device_type: string
  eos_date: string | null
  count: number
}
export type ParsedInventory = {
  rowsRead: number
  rowsUsed: number
  skipped: { reason: string; count: number }[]
  locations: ImportLocation[]
  deviceCounts: ImportDeviceCount[]
  devices: number
  noEosDate: number
  warnings: string[]
}

// Column titles in the file (matched case-insensitively, order does not matter).
export const COLUMNS = {
  locationCode: 'New Location Code',
  locationName: 'Location Name Final',
  country: 'Region',
  category: 'LocationCategorization',
  model: 'Model',
  deviceType: 'DeviceType',
  eosDate: 'EOS Date',
} as const
type Key = keyof typeof COLUMNS

const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9 ._+/=()-]*$/
const CODE_RE = /^[A-Za-z0-9_-]+$/

export class InventoryFormatError extends Error {}

function text(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

/** "Uppsala, DC1: Storgatan 36" -> "Uppsala". Only the city is kept, never the street. */
export function cityFrom(locationName: string): string {
  return locationName.split(',')[0].trim()
}

/** Excel dates, ISO strings, "No LDOS declared", "00:00:00" -> "YYYY-MM-DD" or null. */
export function eosDateFrom(value: unknown): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime()) || value.getUTCFullYear() < 1990) return null // "00:00:00" time-only cells
    return value.toISOString().slice(0, 10)
  }
  const s = text(value)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m && Number(m[1]) >= 1990) return `${m[1]}-${m[2]}-${m[3]}`
  return null // "No LDOS declared", empty, anything else
}

export function parseInventory(sheet: unknown[][]): ParsedInventory {
  if (sheet.length < 2) throw new InventoryFormatError('The sheet is empty.')
  const header = sheet[0].map((h) => text(h).toLowerCase())
  const idx = {} as Record<Key, number>
  const missing: string[] = []
  for (const [key, title] of Object.entries(COLUMNS) as [Key, string][]) {
    const i = header.indexOf(title.toLowerCase())
    if (i < 0) missing.push(title)
    idx[key] = i
  }
  if (missing.length) {
    throw new InventoryFormatError(`Missing required columns: ${missing.join(', ')}`)
  }

  const skipped = new Map<string, number>()
  const skip = (reason: string) => skipped.set(reason, (skipped.get(reason) ?? 0) + 1)
  const locations = new Map<string, ImportLocation>()
  const counts = new Map<string, ImportDeviceCount>()
  const modelTypes = new Map<string, Set<string>>()
  const modelEos = new Map<string, Set<string>>()
  let rowsRead = 0
  let noEos = 0

  for (const row of sheet.slice(1)) {
    if (!row || row.every((c) => text(c) === '')) continue
    rowsRead++
    const code = text(row[idx.locationCode])
    const model = text(row[idx.model])
    const country = text(row[idx.country])
    const deviceType = text(row[idx.deviceType]) || 'Unknown'
    if (!code || !CODE_RE.test(code)) { skip('Missing or invalid location code'); continue }
    if (!model || !MODEL_RE.test(model)) { skip('Missing or invalid model'); continue }
    if (!country) { skip('Missing country (Region)'); continue }

    if (!locations.has(code)) {
      locations.set(code, {
        code,
        city: cityFrom(text(row[idx.locationName])) || 'Unknown',
        country,
        category: text(row[idx.category]) || null,
      })
    }
    const eos = eosDateFrom(row[idx.eosDate])
    if (!eos) noEos++
    const key = [code, model, deviceType, eos ?? ''].join('|')
    const existing = counts.get(key)
    if (existing) existing.count++
    else counts.set(key, { location_code: code, model, device_type: deviceType, eos_date: eos, count: 1 })

    if (!modelTypes.has(model)) modelTypes.set(model, new Set())
    modelTypes.get(model)!.add(deviceType.toLowerCase())
    if (!modelEos.has(model)) modelEos.set(model, new Set())
    modelEos.get(model)!.add(eos ?? 'none')
  }

  const warnings: string[] = []
  const mixedEos = [...modelEos].filter(([, s]) => s.size > 1).map(([m]) => m)
  if (mixedEos.length) warnings.push(`${mixedEos.length} models have different EOS dates in different rows: ${mixedEos.slice(0, 5).join(', ')}${mixedEos.length > 5 ? '…' : ''}`)
  const mixedType = [...modelTypes].filter(([, s]) => s.size > 1).map(([m]) => m)
  if (mixedType.length) warnings.push(`${mixedType.length} models have more than one DeviceType: ${mixedType.slice(0, 5).join(', ')}${mixedType.length > 5 ? '…' : ''}`)

  const deviceCounts = [...counts.values()]
  const devices = deviceCounts.reduce((s, d) => s + d.count, 0)
  return {
    rowsRead,
    rowsUsed: devices,
    skipped: [...skipped].map(([reason, count]) => ({ reason, count })),
    locations: [...locations.values()].sort((a, b) => a.code.localeCompare(b.code)),
    deviceCounts,
    devices,
    noEosDate: noEos,
    warnings,
  }
}

/** "Inventory_2026-10.xlsx" -> "2026-10" (a guess the user can change). */
export function monthFromFileName(name: string): string | null {
  const m = name.match(/(20\d{2})[-_.](0[1-9]|1[0-2])/)
  return m ? `${m[1]}-${m[2]}` : null
}

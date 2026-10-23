import { describe, expect, it } from 'vitest'
import { cityFrom, eosDateFrom, InventoryFormatError, monthFromFileName, parseInventory } from './parseInventory.ts'

const HEADER = ['Caption', 'IP_Address', 'SerialNumber', 'New Location Code', 'Location Name Final', 'Region',
  'LocationCategorization', 'Model', 'DeviceType', 'EOS Date']
const row = (code: string, model: string, eos: unknown, type = 'WAP') =>
  ['host-' + Math.random(), '10.0.0.1', 'SER' + Math.random(), code, 'Vasteras, Storgatan 37', 'Sweden', 'Bronze', model, type, eos]

describe('parseInventory', () => {
  it('aggregates rows and keeps no hostnames, serials, IPs or streets', () => {
    const r = parseInventory([HEADER,
      row('SE0029', 'MR33', new Date('2026-07-21T00:00:00Z')),
      row('SE0029', 'MR33', new Date('2026-07-21T00:00:00Z')),
      row('SE0029', 'MR36', 'No LDOS declared'),
    ])
    expect(r.devices).toBe(3)
    expect(r.deviceCounts).toEqual([
      { location_code: 'SE0029', model: 'MR33', device_type: 'WAP', eos_date: '2026-07-21', count: 2 },
      { location_code: 'SE0029', model: 'MR36', device_type: 'WAP', eos_date: null, count: 1 },
    ])
    expect(r.locations).toEqual([{ code: 'SE0029', city: 'Vasteras', country: 'Sweden', category: 'Bronze' }])
    const json = JSON.stringify(r)
    expect(json).not.toContain('host-')
    expect(json).not.toContain('SER')
    expect(json).not.toContain('10.0.0.1')
    expect(json).not.toContain('Storgatan')
  })

  it('reports missing columns', () => {
    expect(() => parseInventory([['Model'], ['MR33']])).toThrow(InventoryFormatError)
  })

  it('skips rows without a location code or model', () => {
    const r = parseInventory([HEADER, row('', 'MR33', null), row('SE0001', '', null), row('SE0001', 'MR33', null)])
    expect(r.devices).toBe(1)
    expect(r.skipped).toHaveLength(2)
  })
})

describe('helpers', () => {
  it('reads dates', () => {
    expect(eosDateFrom(new Date('2031-07-31T00:00:00Z'))).toBe('2031-07-31')
    expect(eosDateFrom(new Date('1899-12-30T00:00:00Z'))).toBeNull() // "00:00:00"
    expect(eosDateFrom('No LDOS Declared')).toBeNull()
    expect(eosDateFrom('2026-10-31 00:00:00')).toBe('2026-10-31')
  })
  it('keeps only the city', () => {
    expect(cityFrom('Uppsala, DC1: Storgatan 36')).toBe('Uppsala')
  })
  it('guesses the month from the file name', () => {
    expect(monthFromFileName('Inventory_2026-10.xlsx')).toBe('2026-10')
    expect(monthFromFileName('report.xlsx')).toBeNull()
  })
})

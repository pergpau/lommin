import { describe, expect, it } from 'vitest'
import { detectTransfers } from './transfers'
import type { Transaction } from './store'

function tx(partial: Partial<Transaction> & { id: string }): Transaction {
  return {
    accountUid: 'a',
    entryReference: partial.id,
    amount: -100,
    currency: 'NOK',
    description: '',
    status: 'BOOK',
    raw: {},
    ...partial,
  }
}

describe('detectTransfers', () => {
  it('pairs an out/in of equal magnitude across accounts within 3 days', () => {
    const out = tx({ id: 'out', accountUid: 'A', amount: -500, bookingDate: '2024-01-10' })
    const inn = tx({ id: 'in', accountUid: 'B', amount: 500, bookingDate: '2024-01-12' })
    const result = detectTransfers([out, inn])
    expect(result).toEqual(new Set(['out', 'in']))
  })

  it('does not pair transactions on the same account', () => {
    const a = tx({ id: 'a', accountUid: 'A', amount: -500, bookingDate: '2024-01-10' })
    const b = tx({ id: 'b', accountUid: 'A', amount: 500, bookingDate: '2024-01-10' })
    expect(detectTransfers([a, b]).size).toBe(0)
  })

  it('does not pair when more than 3 days apart', () => {
    const out = tx({ id: 'out', accountUid: 'A', amount: -500, bookingDate: '2024-01-01' })
    const inn = tx({ id: 'in', accountUid: 'B', amount: 500, bookingDate: '2024-01-10' })
    expect(detectTransfers([out, inn]).size).toBe(0)
  })

  it('does not pair same-sign amounts', () => {
    const a = tx({ id: 'a', accountUid: 'A', amount: -500, bookingDate: '2024-01-10' })
    const b = tx({ id: 'b', accountUid: 'B', amount: -500, bookingDate: '2024-01-10' })
    expect(detectTransfers([a, b]).size).toBe(0)
  })

  it('matches each transaction at most once', () => {
    const out = tx({ id: 'out', accountUid: 'A', amount: -500, bookingDate: '2024-01-10' })
    const in1 = tx({ id: 'in1', accountUid: 'B', amount: 500, bookingDate: '2024-01-10' })
    const in2 = tx({ id: 'in2', accountUid: 'C', amount: 500, bookingDate: '2024-01-10' })
    const result = detectTransfers([out, in1, in2])
    expect(result.has('out')).toBe(true)
    // Exactly one of the two credits is paired with the single debit.
    expect(result.size).toBe(2)
  })
})

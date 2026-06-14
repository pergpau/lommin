import { fmtAmount } from '../../lib/format'
import type { Transaction } from '../../lib/store'

type FlowSummaryChartProps = { transactions: Transaction[]; currency: string }

export default function FlowSummaryChart({ transactions, currency }: FlowSummaryChartProps) {
  const nonTransfers = transactions.filter((t) => !t.isTransfer)
  const income = nonTransfers
    .filter((t) => !(t.creditDebit ? t.creditDebit === 'DBIT' : t.amount < 0))
    .reduce((s, t) => s + t.amount, 0)
  const expense = Math.abs(
    nonTransfers
      .filter((t) => (t.creditDebit ? t.creditDebit === 'DBIT' : t.amount < 0))
      .reduce((s, t) => s + t.amount, 0),
  )

  if (income === 0 && expense === 0) return null

  const H = 80
  const max = Math.max(income, expense)
  const incomeH = max > 0 ? Math.max(Math.round((income / max) * H), 4) : 0
  const expenseH = max > 0 ? Math.max(Math.round((expense / max) * H), 4) : 0

  return (
    <div className="card p-4 mb-4">
      <div className="text-xs text-muted uppercase tracking-wider mb-4">Månedsoversikt</div>
      <div className="flex gap-8">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-end" style={{ height: `${H}px` }}>
            <div className="w-16 rounded-t bg-positive/60" style={{ height: `${incomeH}px` }} />
          </div>
          <div className="text-xs text-muted mt-1">Inn</div>
          <div className="text-xs mono amount-positive">{fmtAmount(income, currency)}</div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-end" style={{ height: `${H}px` }}>
            <div className="w-16 rounded-t bg-negative/60" style={{ height: `${expenseH}px` }} />
          </div>
          <div className="text-xs text-muted mt-1">Ut</div>
          <div className="text-xs mono amount-negative">-{fmtAmount(expense, currency)}</div>
        </div>
      </div>
    </div>
  )
}

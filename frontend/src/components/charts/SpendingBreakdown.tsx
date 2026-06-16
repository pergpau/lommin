import { useState, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faQuestion } from "@fortawesome/free-solid-svg-icons";
import { MAIN_CATEGORIES, MAIN_CATEGORY_MAP, SUB_CATEGORY_MAP } from "../../lib/categories";
import { getCategoryIcon } from "../../lib/categoryIcons";
import type { Transaction } from "../../lib/store";
import { fmtAmount } from "../../lib/format";
import TransactionTable from "../transactions/TransactionTable";

type SectionType = "expense" | "income" | "saving";

type MainId = number | "uncategorized" | "uncategorized-income";
type SubId = number | "uncategorized";

type View =
  | { level: "main" }
  | { level: "sub"; mainId: MainId; excluded?: boolean }
  | { level: "txns"; mainId: MainId; subId: SubId; excluded?: boolean };

interface Props {
  transactions: Transaction[];
  onCategoryChange?: (txId: string, catId: number | undefined) => Promise<void>;
}

function isEligible(t: Transaction): boolean {
  if (t.categoryId != null && SUB_CATEGORY_MAP[t.categoryId]?.type === "exclude") return false;
  return true;
}

function mainIdOf(t: Transaction): MainId {
  if (t.categoryId == null) return t.amount > 0 ? "uncategorized-income" : "uncategorized";
  const sub = SUB_CATEGORY_MAP[t.categoryId];
  return sub ? sub.mainCategoryId : "uncategorized";
}

function mainType(mainId: MainId): SectionType {
  if (mainId === "uncategorized") return "expense";
  if (mainId === "uncategorized-income") return "income";
  const cat = MAIN_CATEGORY_MAP[mainId as number];
  const firstType = cat?.subCategories.find((s) => s.type !== "exclude")?.type;
  return firstType === "income" || firstType === "saving" ? firstType : "expense";
}

function mainMeta(mainId: MainId): { icon: IconDefinition; name: string; color: string } {
  if (mainId === "uncategorized" || mainId === "uncategorized-income")
    return { icon: faQuestion, name: "Ukategorisert", color: "#9ca3af" };
  const cat = MAIN_CATEGORY_MAP[mainId as number];
  return { icon: getCategoryIcon(cat.id), name: cat.name, color: cat.color };
}

function subMeta(subId: SubId): { icon: IconDefinition; name: string } {
  if (subId === "uncategorized") return { icon: faQuestion, name: "Ukategorisert" };
  const sub = SUB_CATEGORY_MAP[subId as number];
  return { icon: getCategoryIcon(sub?.id), name: sub?.name ?? "Ukjent" };
}

function AmountBar({ total, max, color }: { total: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((total / max) * 100) : 0;
  return (
    <div className="hidden sm:block flex-1 h-2 rounded-full bg-border overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

export default function SpendingBreakdown({ transactions, onCategoryChange }: Props) {
  const [view, setView] = useState<View>({ level: "main" });

  const eligible = useMemo(() => transactions.filter(isEligible), [transactions]);

  const excludedPool = useMemo(
    () =>
      transactions.filter(
        (t) => t.categoryId != null && SUB_CATEGORY_MAP[t.categoryId]?.type === "exclude",
      ),
    [transactions],
  );

  const mainRows = useMemo(() => {
    const map = new Map<MainId, number>();
    for (const t of eligible) {
      const id = mainIdOf(t);
      const delta = mainType(id) === "income" ? t.amount : -t.amount;
      map.set(id, (map.get(id) ?? 0) + delta);
    }
    const rows: { mainId: MainId; total: number }[] = MAIN_CATEGORIES.filter((cat) =>
      cat.subCategories.some((s) => s.type !== "exclude"),
    ).map((cat) => ({ mainId: cat.id as MainId, total: map.get(cat.id) ?? 0 }));
    if (map.has("uncategorized"))
      rows.push({ mainId: "uncategorized", total: map.get("uncategorized")! });
    if (map.has("uncategorized-income"))
      rows.push({ mainId: "uncategorized-income", total: map.get("uncategorized-income")! });
    return rows;
  }, [eligible]);

  const excludedMainRows = useMemo(() => {
    const map = new Map<MainId, number>();
    for (const t of excludedPool) {
      const id = mainIdOf(t);
      const delta = mainType(id) === "income" ? t.amount : -t.amount;
      map.set(id, (map.get(id) ?? 0) + delta);
    }
    return MAIN_CATEGORIES.filter((cat) =>
      cat.subCategories.every((s) => s.type === "exclude"),
    ).map((cat) => ({ mainId: cat.id as MainId, total: map.get(cat.id) ?? 0 }));
  }, [excludedPool]);

  if (eligible.length === 0 && excludedPool.length === 0) {
    return (
      <div className="card p-10 text-center text-muted text-sm">
        Ingen transaksjoner denne måneden.
      </div>
    );
  }

  // ── Level 2: transaction list ──
  if (view.level === "txns") {
    const { mainId, subId, excluded } = view;
    const pool = excluded ? excludedPool : eligible;
    const m = mainMeta(mainId);
    const s = subMeta(subId);
    const filtered = pool.filter((t) =>
      subId === "uncategorized" ? !t.categoryId : t.categoryId === (subId as number),
    );
    return (
      <div>
        <button
          className="flex items-center gap-1.5 text-sm text-muted hover:text-text mb-4 transition-colors"
          onClick={() => setView({ level: "sub", mainId, ...(excluded ? { excluded: true } : {}) })}
        >
          ← <span style={{ color: m.color }}><FontAwesomeIcon icon={m.icon} className="w-3.5 h-3.5" /></span> {m.name}
        </button>
        <div className="flex items-center gap-2 mb-4">
          <span className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center" style={{ backgroundColor: m.color + "22", color: m.color }}>
            <FontAwesomeIcon icon={s.icon} className="w-3.5 h-3.5" />
          </span>
          <span className="text-sm font-medium text-text">{s.name}</span>
        </div>
        <TransactionTable transactions={filtered} onCategoryChange={onCategoryChange} />
      </div>
    );
  }

  // ── Level 1: sub-category breakdown ──
  if (view.level === "sub") {
    const { mainId, excluded } = view;
    const pool = excluded ? excludedPool : eligible;
    const m = mainMeta(mainId);

    // Uncategorized has no sub-categories — show transaction list directly
    if (mainId === "uncategorized" || mainId === "uncategorized-income") {
      const filtered = pool.filter((t) => mainIdOf(t) === mainId);
      return (
        <div>
          <button
            className="flex items-center gap-1.5 text-sm text-muted hover:text-text mb-4 transition-colors"
            onClick={() => setView({ level: "main" })}
          >
            ← Tilbake
          </button>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-muted">?</span>
            <span className="text-sm font-medium text-text">Ukategorisert</span>
          </div>
          <TransactionTable transactions={filtered} onCategoryChange={onCategoryChange} />
        </div>
      );
    }

    const subTxns = pool.filter((t) => mainIdOf(t) === mainId);
    const subMap = new Map<number, number>();
    for (const t of subTxns) {
      if (t.categoryId != null) {
        const subType = SUB_CATEGORY_MAP[t.categoryId]?.type;
        const delta = subType === "income" ? t.amount : -t.amount;
        subMap.set(t.categoryId, (subMap.get(t.categoryId) ?? 0) + delta);
      }
    }
    const subRows = [...subMap.entries()]
      .map(([subId, total]) => ({ subId, total }))
      .sort((a, b) => b.total - a.total);
    const subMax = subRows[0]?.total ?? 0;

    return (
      <div>
        <button
          className="flex items-center gap-1.5 text-sm text-muted hover:text-text mb-4 transition-colors"
          onClick={() => setView({ level: "main" })}
        >
          ← Tilbake
        </button>
        <div className="card overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <span className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: m.color + "22", color: m.color }}>
              <FontAwesomeIcon icon={m.icon} className="w-3.5 h-3.5" />
            </span>
            <span className="text-sm font-medium text-text">{m.name}</span>
          </div>
          <div className="divide-y divide-border">
            {subRows.map(({ subId, total }) => {
              const s = subMeta(subId);
              return (
                <button
                  key={subId}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-surface-2 transition-colors text-left"
                  onClick={() =>
                    setView({
                      level: "txns",
                      mainId,
                      subId,
                      ...(excluded ? { excluded: true } : {}),
                    })
                  }
                >
                  <span className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center" style={{ backgroundColor: m.color + "22", color: m.color }}>
                    <FontAwesomeIcon icon={s.icon} className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-sm text-text flex-1 sm:flex-none sm:w-36 truncate">{s.name}</span>
                  <AmountBar total={total} max={subMax} color={m.color} />
                  <span className="text-sm font-medium text-text tabular-nums mono shrink-0 text-right w-28">
                    {fmtAmount(total)} kr
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <TransactionTable transactions={subTxns} onCategoryChange={onCategoryChange} />
      </div>
    );
  }

  // ── Level 0: main category breakdown ──
  const expenseRows = mainRows.filter((r) => mainType(r.mainId) === "expense");
  const incomeRows = mainRows.filter((r) => mainType(r.mainId) === "income");
  const savingRows = mainRows.filter((r) => mainType(r.mainId) === "saving");

  function renderRows(rows: typeof mainRows, max: number, excluded?: boolean) {
    return rows.map(({ mainId, total }) => {
      const m = mainMeta(mainId);
      return (
        <button
          key={mainId}
          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-surface-2 transition-colors text-left"
          onClick={() => setView({ level: "sub", mainId, ...(excluded ? { excluded: true } : {}) })}
        >
          <span className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center" style={{ backgroundColor: m.color + "22", color: m.color }}>
            <FontAwesomeIcon icon={m.icon} className="w-3.5 h-3.5" />
          </span>
          <span className="text-sm text-text flex-1 sm:flex-none sm:w-36 truncate">{m.name}</span>
          <AmountBar total={total} max={max} color={m.color} />
          <span className="text-sm font-medium text-text tabular-nums mono shrink-0 text-right w-28">
            {fmtAmount(total)} kr
          </span>
        </button>
      );
    });
  }

  const maxExpense = Math.max(0, ...expenseRows.map((r) => r.total));
  const maxIncome = Math.max(0, ...incomeRows.map((r) => r.total));
  const maxSaving = Math.max(0, ...savingRows.map((r) => r.total));
  const maxExcluded = Math.max(0, ...excludedMainRows.map((r) => r.total));

  const sections: { label: string; rows: typeof mainRows; max: number; excluded?: boolean }[] = [
    { label: "Utgifter", rows: expenseRows, max: maxExpense },
    { label: "Inntekter", rows: incomeRows, max: maxIncome },
    { label: "Sparing", rows: savingRows, max: maxSaving },
    { label: "Ekskludert", rows: excludedMainRows, max: maxExcluded, excluded: true },
  ];

  return (
    <div className="flex flex-col gap-6">
      {sections.map(({ label, rows, max, excluded }) => (
          <div key={label}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2 px-1">
              {label}
            </h3>
            <div className="card overflow-hidden">
              <div className="divide-y divide-border">{renderRows(rows, max, excluded)}</div>
            </div>
          </div>
        ))}
    </div>
  );
}

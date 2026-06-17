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


export default function SpendingBreakdown({ transactions, onCategoryChange }: Props) {
  const [view, setView] = useState<View>({ level: "main" });
  const [showAll, setShowAll] = useState(false);
  const [showAllIncome, setShowAllIncome] = useState(false);

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

  const inntektSubRows = useMemo(() => {
    const inntektId = 11;
    const subMap = new Map<number, number>();
    for (const t of eligible) {
      if (mainIdOf(t) === inntektId && t.categoryId != null) {
        subMap.set(t.categoryId, (subMap.get(t.categoryId) ?? 0) + t.amount);
      }
    }
    const uncatTotal = eligible
      .filter((t) => mainIdOf(t) === "uncategorized-income")
      .reduce((sum, t) => sum + t.amount, 0);
    const cat = MAIN_CATEGORY_MAP[inntektId];
    const rows: { subId: SubId; total: number; mainId: MainId; isUncat?: boolean }[] = cat
      ? cat.subCategories
          .filter((s) => s.type !== "exclude")
          .map((s) => ({ subId: s.id as SubId, total: subMap.get(s.id) ?? 0, mainId: inntektId as MainId }))
      : [];
    if (uncatTotal > 0) {
      rows.push({ subId: "uncategorized", total: uncatTotal, mainId: "uncategorized-income", isUncat: true });
    }
    return rows.sort((a, b) => b.total - a.total);
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
    const subTotal = subRows.reduce((sum, r) => sum + r.total, 0);

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
                const pct = subTotal > 0 ? (total / subTotal) * 100 : 0;
                return (
                  <button
                    key={subId}
                    className="w-full px-4 py-3 flex items-center gap-3 transition-colors text-left"
                    style={{ backgroundColor: m.color + "12" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = m.color + "25")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = m.color + "12")}
                    onClick={() =>
                      setView({ level: "txns", mainId, subId, ...(excluded ? { excluded: true } : {}) })
                    }
                  >
                    <span
                      className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center"
                      style={{ backgroundColor: m.color + "22", color: m.color }}
                    >
                      <FontAwesomeIcon icon={s.icon} className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-sm text-text flex-1 truncate">{s.name}</span>
                    <span className="text-xs text-muted tabular-nums mono shrink-0 w-10 text-right">
                      {pct.toFixed(0)}%
                    </span>
                    <span className="text-sm font-medium text-text tabular-nums mono shrink-0 text-right w-28">
                      {fmtAmount(total, undefined, 0)} kr
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
  const expenseRows = mainRows.filter((r) => mainType(r.mainId) === "expense").sort((a, b) => b.total - a.total);
  const savingRows = mainRows.filter((r) => mainType(r.mainId) === "saving").sort((a, b) => b.total - a.total);

  function pillClass(active: boolean) {
    return `text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
      active
        ? "border-accent text-accent bg-accent/10"
        : "border-border text-muted hover:text-text hover:border-text/30"
    }`;
  }

  function renderRows(rows: { mainId: MainId; total: number }[], excluded?: boolean) {
    const sectionTotal = rows.reduce((sum, r) => sum + r.total, 0);
    return rows.map(({ mainId, total }) => {
      const m = mainMeta(mainId);
      const pct = sectionTotal > 0 ? (total / sectionTotal) * 100 : 0;
      const showPct = !excluded && total > 0;
      return (
        <button
          key={mainId}
          className="w-full px-4 py-3 flex items-center gap-3 transition-colors text-left"
          style={{ backgroundColor: m.color + "12" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = m.color + "25")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = m.color + "12")}
          onClick={() => setView({ level: "sub", mainId, ...(excluded ? { excluded: true } : {}) })}
        >
          <span className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center" style={{ backgroundColor: m.color + "22", color: m.color }}>
            <FontAwesomeIcon icon={m.icon} className="w-3.5 h-3.5" />
          </span>
          <span className="text-sm text-text flex-1 truncate">{m.name}</span>
          <span className="text-xs text-muted tabular-nums mono shrink-0 w-10 text-right">
            {showPct ? `${pct.toFixed(0)}%` : ""}
          </span>
          <span className="text-sm font-medium text-text tabular-nums mono shrink-0 text-right w-28">
            {fmtAmount(total, undefined, 0)} kr
          </span>
        </button>
      );
    });
  }

  const visibleExpenseRows = showAll ? expenseRows : expenseRows.filter((r) => r.total > 0);
  const visibleSavingRows = showAll ? savingRows : savingRows.filter((r) => r.total > 0);
  const visibleExcludedRows = showAll ? excludedMainRows : excludedMainRows.filter((r) => r.total > 0);
  const visibleIncomeRows = showAllIncome ? inntektSubRows : inntektSubRows.filter((r) => r.total > 0);
  const incomeSectionTotal = inntektSubRows.reduce((sum, r) => sum + r.total, 0);
  const inntektColor = MAIN_CATEGORY_MAP[11]?.color ?? "#16a34a";

  return (
    <div className="flex flex-col gap-6">
      {visibleExpenseRows.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Utgifter</h3>
            <button onClick={() => setShowAll((v) => !v)} className={pillClass(showAll)}>
              Vis alle
            </button>
          </div>
          <div className="card overflow-hidden">
            <div className="divide-y divide-border">{renderRows(visibleExpenseRows)}</div>
          </div>
        </div>
      )}

      {visibleIncomeRows.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Inntekter</h3>
            <button onClick={() => setShowAllIncome((v) => !v)} className={pillClass(showAllIncome)}>
              Vis alle
            </button>
          </div>
          <div className="card overflow-hidden">
            <div className="divide-y divide-border">
              {visibleIncomeRows.map(({ subId, total, mainId, isUncat }) => {
                const s = subMeta(subId);
                const pct = incomeSectionTotal > 0 ? (total / incomeSectionTotal) * 100 : 0;
                return (
                  <button
                    key={String(subId)}
                    className="w-full px-4 py-3 flex items-center gap-3 transition-colors text-left"
                    style={{ backgroundColor: isUncat ? "#9ca3af12" : inntektColor + "12" }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isUncat ? "#9ca3af25" : inntektColor + "25")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isUncat ? "#9ca3af12" : inntektColor + "12")}
                    onClick={() =>
                      isUncat
                        ? setView({ level: "sub", mainId })
                        : setView({ level: "txns", mainId, subId })
                    }
                  >
                    <span
                      className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center"
                      style={isUncat ? { backgroundColor: "#9ca3af22", color: "#9ca3af" } : { backgroundColor: inntektColor + "22", color: inntektColor }}
                    >
                      <FontAwesomeIcon icon={s.icon} className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-sm text-text flex-1 truncate">{s.name}</span>
                    <span className="text-xs text-muted tabular-nums mono shrink-0 w-10 text-right">
                      {total > 0 ? `${pct.toFixed(0)}%` : ""}
                    </span>
                    <span className="text-sm font-medium text-text tabular-nums mono shrink-0 text-right w-28">
                      {fmtAmount(total, undefined, 0)} kr
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {visibleSavingRows.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Sparing</h3>
          </div>
          <div className="card overflow-hidden">
            <div className="divide-y divide-border">{renderRows(visibleSavingRows)}</div>
          </div>
        </div>
      )}

      {visibleExcludedRows.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Ekskludert</h3>
          </div>
          <div className="card overflow-hidden">
            <div className="divide-y divide-border">{renderRows(visibleExcludedRows, true)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

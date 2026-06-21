import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
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
  subtitle?: string;
  onCategoryChange?: (txId: string, catId: number | undefined) => Promise<void>;
  onExcludeFromCalculationsChange?: (txId: string, value: boolean) => Promise<void>;
}

function isEligible(t: Transaction): boolean {
  if (t.excludeFromCalculations) return false;
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

function mainMeta(mainId: MainId): { icon: IconDefinition; color: string } {
  if (mainId === "uncategorized" || mainId === "uncategorized-income")
    return { icon: faQuestion, color: "#9ca3af" };
  const cat = MAIN_CATEGORY_MAP[mainId as number];
  return { icon: getCategoryIcon(cat.id), color: cat.color };
}

function subMeta(subId: SubId): { icon: IconDefinition } {
  if (subId === "uncategorized") return { icon: faQuestion };
  const sub = SUB_CATEGORY_MAP[subId as number];
  return { icon: getCategoryIcon(sub?.id) };
}

function getMainName(mainId: MainId, t: TFunction): string {
  if (mainId === "uncategorized" || mainId === "uncategorized-income")
    return t("categories:uncategorized");
  return t("categories:main." + mainId);
}

function getSubName(subId: SubId, t: TFunction): string {
  if (subId === "uncategorized") return t("categories:uncategorized");
  const sub = SUB_CATEGORY_MAP[subId as number];
  if (!sub) return t("categories:unknown");
  return t("categories:sub." + sub.id);
}

type SubRow = { subId: SubId; total: number; count: number; mainId: MainId; isUncat?: boolean };

function buildSubRows(
  pool: Transaction[],
  mainId: number,
  sign: 1 | -1,
): SubRow[] {
  const subMap = new Map<number, number>();
  const subCountMap = new Map<number, number>();
  for (const tx of pool) {
    if (mainIdOf(tx) === mainId && tx.categoryId != null) {
      subMap.set(tx.categoryId, (subMap.get(tx.categoryId) ?? 0) + sign * tx.amount);
      subCountMap.set(tx.categoryId, (subCountMap.get(tx.categoryId) ?? 0) + 1);
    }
  }
  const cat = MAIN_CATEGORY_MAP[mainId];
  return cat
    ? cat.subCategories.map((s) => ({
        subId: s.id as SubId,
        total: subMap.get(s.id) ?? 0,
        count: subCountMap.get(s.id) ?? 0,
        mainId: mainId as MainId,
      }))
    : [];
}


export default function SpendingBreakdown({ transactions, subtitle, onCategoryChange, onExcludeFromCalculationsChange }: Props) {
  const { t } = useTranslation(["charts", "categories"]);
  const [view, setView] = useState<View>({ level: "main" });
  const [showAll, setShowAll] = useState(false);

  const eligible = useMemo(() => transactions.filter(isEligible), [transactions]);

  // For transaction lists inside a category drill-down we want to show extraordinary
  // transactions too — they're excluded from totals/charts but still belong to a category.
  const nonExcluded = useMemo(
    () => transactions.filter((t) => !(t.categoryId != null && SUB_CATEGORY_MAP[t.categoryId]?.type === "exclude")),
    [transactions],
  );

  const excludedPool = useMemo(
    () =>
      transactions.filter(
        (tx) => tx.categoryId != null && SUB_CATEGORY_MAP[tx.categoryId]?.type === "exclude",
      ),
    [transactions],
  );

  const mainRows = useMemo(() => {
    const map = new Map<MainId, number>();
    const countMap = new Map<MainId, number>();
    for (const tx of eligible) {
      const id = mainIdOf(tx);
      const delta = mainType(id) === "income" ? tx.amount : -tx.amount;
      map.set(id, (map.get(id) ?? 0) + delta);
      countMap.set(id, (countMap.get(id) ?? 0) + 1);
    }
    const rows: { mainId: MainId; total: number; count: number }[] = MAIN_CATEGORIES.filter((cat) =>
      cat.subCategories.some((s) => s.type !== "exclude"),
    ).map((cat) => ({ mainId: cat.id as MainId, total: map.get(cat.id) ?? 0, count: countMap.get(cat.id) ?? 0 }));
    if (countMap.has("uncategorized"))
      rows.push({ mainId: "uncategorized", total: map.get("uncategorized")!, count: countMap.get("uncategorized")! });
    if (countMap.has("uncategorized-income"))
      rows.push({ mainId: "uncategorized-income", total: map.get("uncategorized-income")!, count: countMap.get("uncategorized-income")! });
    return rows;
  }, [eligible]);

  const inntektSubRows = useMemo(() => {
    const rows = buildSubRows(eligible, 11, 1);
    const uncatTxns = eligible.filter((tx) => mainIdOf(tx) === "uncategorized-income");
    const uncatTotal = uncatTxns.reduce((sum, tx) => sum + tx.amount, 0);
    if (uncatTxns.length > 0)
      rows.push({ subId: "uncategorized", total: uncatTotal, count: uncatTxns.length, mainId: "uncategorized-income", isUncat: true });
    return rows.sort((a, b) => b.total - a.total);
  }, [eligible]);

  const sparingSubRows = useMemo(
    () => buildSubRows(eligible, 20, -1).sort((a, b) => b.total - a.total),
    [eligible],
  );

  const excludedSubRows = useMemo(
    () => buildSubRows(excludedPool, 10, -1).sort((a, b) => b.total - a.total),
    [excludedPool],
  );

  if (eligible.length === 0 && excludedPool.length === 0) {
    return (
      <div className="card p-10 text-center text-muted text-sm">
        {t("charts:breakdown.noTransactions")}
      </div>
    );
  }

  // ── Level 2: transaction list ──
  if (view.level === "txns") {
    const { mainId, subId, excluded } = view;
    const pool = excluded ? excludedPool : nonExcluded;
    const m = mainMeta(mainId);
    const s = subMeta(subId);
    const filtered = pool.filter((tx) =>
      subId === "uncategorized" ? !tx.categoryId : tx.categoryId === (subId as number),
    );
    const subType = subId !== "uncategorized" ? SUB_CATEGORY_MAP[subId as number]?.type : undefined;
    const filteredTotal = filtered.reduce((sum, tx) => sum + (subType === "income" ? tx.amount : -tx.amount), 0);
    return (
      <div>
        <button
          className="flex items-center gap-1.5 text-sm text-muted hover:text-text mb-4 transition-colors"
          onClick={() => setView({ level: "sub", mainId, ...(excluded ? { excluded: true } : {}) })}
        >
          ← <span style={{ color: m.color }}><FontAwesomeIcon icon={m.icon} className="w-3.5 h-3.5" /></span> {getMainName(mainId, t)}
        </button>
        <div className="flex items-center gap-2 mb-4 px-4 py-3 rounded-xl" style={{ backgroundColor: m.color + "12" }}>
          <span className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center" style={{ backgroundColor: m.color + "22", color: m.color }}>
            <FontAwesomeIcon icon={s.icon} className="w-3.5 h-3.5" />
          </span>
          <span className="text-sm font-medium text-text flex-1">{getSubName(subId, t)}</span>
          <span className="text-sm font-medium text-text tabular-nums mono">{fmtAmount(filteredTotal, undefined, 0)} kr</span>
        </div>
        <TransactionTable transactions={filtered} subtitle={subtitle} onCategoryChange={onCategoryChange} onExcludeFromCalculationsChange={onExcludeFromCalculationsChange} />
      </div>
    );
  }

  // ── Level 1: sub-category breakdown ──
  if (view.level === "sub") {
    const { mainId, excluded } = view;
    const pool = excluded ? excludedPool : nonExcluded;
    const m = mainMeta(mainId);

    if (mainId === "uncategorized" || mainId === "uncategorized-income") {
      const filtered = pool.filter((tx) => mainIdOf(tx) === mainId);
      return (
        <div>
          <button
            className="flex items-center gap-1.5 text-sm text-muted hover:text-text mb-4 transition-colors"
            onClick={() => setView({ level: "main" })}
          >
            {t("charts:breakdown.back")}
          </button>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-muted">?</span>
            <span className="text-sm font-medium text-text">{t("charts:breakdown.uncategorized")}</span>
          </div>
          <TransactionTable transactions={filtered} subtitle={subtitle} onCategoryChange={onCategoryChange} onExcludeFromCalculationsChange={onExcludeFromCalculationsChange} />
        </div>
      );
    }

    const subTxns = pool.filter((tx) => mainIdOf(tx) === mainId);
    const subMap = new Map<number, number>();
    for (const tx of subTxns) {
      if (tx.categoryId != null) {
        const subType = SUB_CATEGORY_MAP[tx.categoryId]?.type;
        const delta = subType === "income" ? tx.amount : -tx.amount;
        subMap.set(tx.categoryId, (subMap.get(tx.categoryId) ?? 0) + delta);
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
          {t("charts:breakdown.back")}
        </button>
        <div className="card overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2" style={{ backgroundColor: m.color + "12" }}>
              <span className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: m.color + "22", color: m.color }}>
                <FontAwesomeIcon icon={m.icon} className="w-3.5 h-3.5" />
              </span>
              <span className="text-sm font-medium text-text flex-1">{getMainName(mainId, t)}</span>
              <span className="text-sm font-medium text-text tabular-nums mono">{fmtAmount(subTotal, undefined, 0)} kr</span>
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
                    <span className="text-sm text-text flex-1 truncate">{getSubName(subId, t)}</span>
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
        <TransactionTable transactions={subTxns} subtitle={subtitle} onCategoryChange={onCategoryChange} onExcludeFromCalculationsChange={onExcludeFromCalculationsChange} />
      </div>
    );
  }

  // ── Level 0: main category breakdown ──
  const expenseRows = mainRows.filter((r) => mainType(r.mainId) === "expense").sort((a, b) => b.total - a.total);

  function pillClass(active: boolean) {
    return `text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
      active
        ? "border-accent text-accent bg-accent/10"
        : "border-border text-muted hover:text-text hover:border-text/30"
    }`;
  }

  function renderRows(rows: { mainId: MainId; total: number; count: number }[]) {
    const sectionTotal = rows.reduce((sum, r) => sum + r.total, 0);
    return rows.map(({ mainId, total, count }) => {
      const m = mainMeta(mainId);
      const pct = sectionTotal > 0 ? (total / sectionTotal) * 100 : 0;
      return (
        <button
          key={mainId}
          className="w-full px-4 py-3 flex items-center gap-3 transition-colors text-left"
          style={{ backgroundColor: m.color + "12" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = m.color + "25")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = m.color + "12")}
          onClick={() => setView({ level: "sub", mainId })}
        >
          <span className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center" style={{ backgroundColor: m.color + "22", color: m.color }}>
            <FontAwesomeIcon icon={m.icon} className="w-3.5 h-3.5" />
          </span>
          <span className="text-sm text-text flex-1 truncate">{getMainName(mainId, t)}</span>
          <span className="text-xs text-muted tabular-nums mono shrink-0 w-10 text-right">
            {count > 0 ? `${pct.toFixed(0)}%` : ""}
          </span>
          <span className="text-sm font-medium text-text tabular-nums mono shrink-0 text-right w-28">
            {fmtAmount(total, undefined, 0)} kr
          </span>
        </button>
      );
    });
  }

  function renderSubRows(rows: SubRow[], color: string, sectionTotal: number, excluded?: boolean) {
    return rows.map(({ subId, total, count, mainId, isUncat }) => {
      const s = subMeta(subId);
      const pct = sectionTotal > 0 ? (total / sectionTotal) * 100 : 0;
      const rowColor = isUncat ? "#9ca3af" : color;
      return (
        <button
          key={String(subId)}
          className="w-full px-4 py-3 flex items-center gap-3 transition-colors text-left"
          style={{ backgroundColor: rowColor + "12" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = rowColor + "25")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = rowColor + "12")}
          onClick={() =>
            isUncat
              ? setView({ level: "sub", mainId })
              : setView({ level: "txns", mainId, subId, ...(excluded ? { excluded: true } : {}) })
          }
        >
          <span
            className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center"
            style={{ backgroundColor: rowColor + "22", color: rowColor }}
          >
            <FontAwesomeIcon icon={s.icon} className="w-3.5 h-3.5" />
          </span>
          <span className="text-sm text-text flex-1 truncate">{getSubName(subId, t)}</span>
          <span className="text-xs text-muted tabular-nums mono shrink-0 w-10 text-right">
            {count > 0 ? `${pct.toFixed(0)}%` : ""}
          </span>
          <span className="text-sm font-medium text-text tabular-nums mono shrink-0 text-right w-28">
            {fmtAmount(total, undefined, 0)} kr
          </span>
        </button>
      );
    });
  }

  const visibleExpenseRows = showAll ? expenseRows : expenseRows.filter((r) => r.count > 0);
  const visibleIncomeRows = showAll ? inntektSubRows : inntektSubRows.filter((r) => r.count > 0);
  const visibleSparingSubs = showAll ? sparingSubRows : sparingSubRows.filter((r) => r.count > 0);
  const visibleExcludedSubs = showAll ? excludedSubRows : excludedSubRows.filter((r) => r.count > 0);

  const incomeSectionTotal = inntektSubRows.reduce((sum, r) => sum + r.total, 0);
  const sparingSectionTotal = sparingSubRows.reduce((sum, r) => sum + r.total, 0);
  const excludedSectionTotal = excludedSubRows.reduce((sum, r) => sum + r.total, 0);

  const inntektColor = MAIN_CATEGORY_MAP[11]?.color ?? "#16a34a";
  const sparingColor = MAIN_CATEGORY_MAP[20]?.color ?? "#8b3eb8";
  const excludedColor = MAIN_CATEGORY_MAP[10]?.color ?? "#6b7280";

  return (
    <div className="flex flex-col gap-6">
      {visibleExpenseRows.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{t("charts:breakdown.expenses")}</h3>
            <button onClick={() => setShowAll((v) => !v)} className={pillClass(showAll)}>
              {t("charts:breakdown.showAll")}
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
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{t("charts:breakdown.income")}</h3>
          </div>
          <div className="card overflow-hidden">
            <div className="divide-y divide-border">
              {renderSubRows(visibleIncomeRows, inntektColor, incomeSectionTotal)}
            </div>
          </div>
        </div>
      )}

      {sparingSubRows.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{t("charts:breakdown.saving")}</h3>
          </div>
          {visibleSparingSubs.length > 0 && (
            <div className="card overflow-hidden">
              <div className="divide-y divide-border">
                {renderSubRows(visibleSparingSubs, sparingColor, sparingSectionTotal)}
              </div>
            </div>
          )}
        </div>
      )}

      {excludedSubRows.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{t("charts:breakdown.excluded")}</h3>
          </div>
          {visibleExcludedSubs.length > 0 && (
            <div className="card overflow-hidden">
              <div className="divide-y divide-border">
                {renderSubRows(visibleExcludedSubs, excludedColor, excludedSectionTotal, true)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

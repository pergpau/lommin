import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { faQuestion } from "@fortawesome/free-solid-svg-icons";
import { MAIN_CATEGORY_MAP, SUB_CATEGORY_MAP } from "../../lib/categories";
import { getCategoryIcon } from "../../lib/categoryIcons";
import CategoryRow from "./CategoryRow";
import type { Breakdown, MainId, SubId, SubRow } from "../../lib/transactionView";
import EmptyState from "../ui/EmptyState";
import TransactionTable from "../transactions/TransactionTable";

const UNCATEGORIZED_COLOR = "#9ca3af";

function pctOf(total: number, sectionTotal: number): number {
  return sectionTotal > 0 ? (total / sectionTotal) * 100 : 0;
}

type View =
  | { level: "main" }
  | { level: "sub"; mainId: MainId; excluded?: boolean }
  | { level: "txns"; mainId: MainId; subId: SubId; excluded?: boolean };

interface Props {
  breakdown: Breakdown;
  subtitle?: string;
  onMutated?: () => void;
  goBackRef?: React.MutableRefObject<(() => boolean) | null>;
}

function mainMeta(mainId: MainId): { icon: IconDefinition; color: string } {
  if (mainId === "uncategorized" || mainId === "uncategorized-income")
    return { icon: faQuestion, color: UNCATEGORIZED_COLOR };
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

export default function SpendingBreakdown({ breakdown, subtitle, onMutated, goBackRef }: Props) {
  const { t } = useTranslation(["charts", "categories"]);
  const [view, setView] = useState<View>({ level: "main" });
  const [showAll, setShowAll] = useState(false);

  const goBack = useCallback((): boolean => {
    if (view.level === "txns") {
      setView({ level: "sub", mainId: view.mainId, ...(view.excluded ? { excluded: true } : {}) });
      return true;
    }
    if (view.level === "sub") {
      setView({ level: "main" });
      return true;
    }
    return false;
  }, [view]);

  useEffect(() => {
    if (goBackRef) goBackRef.current = goBack;
    return () => {
      if (goBackRef) goBackRef.current = null;
    };
  }, [goBackRef, goBack]);

  if (breakdown.isEmpty) {
    return <EmptyState message={t("charts:breakdown.noTransactions")} />;
  }

  // ── Level 2: transaction list ──
  if (view.level === "txns") {
    const { mainId, subId, excluded } = view;
    const m = mainMeta(mainId);
    const s = subMeta(subId);
    const { transactions, total } = breakdown.transactionsFor({ mainId, subId, excluded });
    return (
      <div>
        <button
          className="flex items-center gap-1.5 text-sm text-muted hover:text-text mb-4 transition-colors"
          onClick={() => setView({ level: "sub", mainId, ...(excluded ? { excluded: true } : {}) })}
        >
          ←{" "}
          <span style={{ color: m.color }}>
            <FontAwesomeIcon icon={m.icon} className="w-3.5 h-3.5" />
          </span>{" "}
          {getMainName(mainId, t)}
        </button>
        <CategoryRow
          header
          className="mb-4 rounded-xl"
          icon={s.icon}
          color={m.color}
          name={getSubName(subId, t)}
          amount={total}
        />
        <TransactionTable transactions={transactions} subtitle={subtitle} onMutated={onMutated} />
      </div>
    );
  }

  // ── Level 1: sub-category breakdown ──
  if (view.level === "sub") {
    const { mainId, excluded } = view;
    const m = mainMeta(mainId);
    const { transactions: subTxns } = breakdown.transactionsFor({ mainId, excluded });

    if (mainId === "uncategorized" || mainId === "uncategorized-income") {
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
            <span className="text-sm font-medium text-text">
              {t("charts:breakdown.uncategorized")}
            </span>
          </div>
          <TransactionTable transactions={subTxns} subtitle={subtitle} onMutated={onMutated} />
        </div>
      );
    }

    const allSubRows = breakdown.subRowsFor(mainId, excluded);
    const subRows = showAll ? allSubRows : allSubRows.filter((r) => r.count > 0);
    const subTotal = allSubRows.reduce((sum, r) => sum + r.total, 0);

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button
            className="flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors"
            onClick={() => setView({ level: "main" })}
          >
            {t("charts:breakdown.back")}
          </button>
          <button onClick={() => setShowAll((v) => !v)} className={pillClass(showAll)}>
            {t("charts:breakdown.showAll")}
          </button>
        </div>
        <div className="card overflow-hidden mb-6">
          <CategoryRow
            header
            className="border-b border-border"
            icon={m.icon}
            color={m.color}
            chipSize="sm"
            name={getMainName(mainId, t)}
            amount={subTotal}
          />
          <div className="divide-y divide-border">
            {subRows.map(({ subId, total, count }) => (
              <CategoryRow
                key={subId}
                icon={subMeta(subId).icon}
                color={m.color}
                name={getSubName(subId, t)}
                amount={total}
                pct={count > 0 ? pctOf(total, subTotal) : undefined}
                onClick={() =>
                  setView({
                    level: "txns",
                    mainId,
                    subId,
                    ...(excluded ? { excluded: true } : {}),
                  })
                }
              />
            ))}
          </div>
        </div>
        <TransactionTable transactions={subTxns} subtitle={subtitle} onMutated={onMutated} />
      </div>
    );
  }

  // ── Level 0: main category breakdown ──
  const { expenseRows, incomeRows, savingRows, excludedRows } = breakdown;

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
      return (
        <CategoryRow
          key={mainId}
          icon={m.icon}
          color={m.color}
          name={getMainName(mainId, t)}
          amount={total}
          pct={count > 0 ? pctOf(total, sectionTotal) : undefined}
          onClick={() => setView({ level: "sub", mainId })}
        />
      );
    });
  }

  function renderSubRows(rows: SubRow[], color: string, sectionTotal: number, excluded?: boolean) {
    return rows.map(({ subId, total, count, mainId, isUncat }) => (
      <CategoryRow
        key={String(subId)}
        icon={subMeta(subId).icon}
        color={isUncat ? UNCATEGORIZED_COLOR : color}
        name={getSubName(subId, t)}
        amount={total}
        pct={count > 0 ? pctOf(total, sectionTotal) : undefined}
        onClick={() =>
          isUncat
            ? setView({ level: "sub", mainId })
            : setView({ level: "txns", mainId, subId, ...(excluded ? { excluded: true } : {}) })
        }
      />
    ));
  }

  const visibleExpenseRows = showAll ? expenseRows : expenseRows.filter((r) => r.count > 0);
  const visibleIncomeRows = showAll ? incomeRows : incomeRows.filter((r) => r.count > 0);
  const visibleSavingRows = showAll ? savingRows : savingRows.filter((r) => r.count > 0);
  const visibleExcludedRows = showAll ? excludedRows : excludedRows.filter((r) => r.count > 0);

  const incomeSectionTotal = incomeRows.reduce((sum, r) => sum + r.total, 0);
  const savingSectionTotal = savingRows.reduce((sum, r) => sum + r.total, 0);
  const excludedSectionTotal = excludedRows.reduce((sum, r) => sum + r.total, 0);

  const incomeColor = MAIN_CATEGORY_MAP[11]?.color ?? "#16a34a";
  const savingColor = MAIN_CATEGORY_MAP[20]?.color ?? "#8b3eb8";
  const excludedColor = MAIN_CATEGORY_MAP[10]?.color ?? "#6b7280";

  const hasExpense = showAll || expenseRows.some((r) => r.count > 0);
  const hasIncome = showAll || incomeRows.some((r) => r.count > 0);
  const hasSaving = showAll || savingRows.some((r) => r.count > 0);
  const hasExcluded = showAll || excludedRows.some((r) => r.count > 0);

  return (
    <div className="flex flex-col gap-6">
      {hasExpense && (
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t("charts:breakdown.expenses")}
            </h3>
            <button onClick={() => setShowAll((v) => !v)} className={pillClass(showAll)}>
              {t("charts:breakdown.showAll")}
            </button>
          </div>
          <div className="card overflow-hidden">
            <div className="divide-y divide-border">{renderRows(visibleExpenseRows)}</div>
          </div>
        </div>
      )}

      {hasIncome && (
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t("charts:breakdown.income")}
            </h3>
          </div>
          <div className="card overflow-hidden">
            <div className="divide-y divide-border">
              {renderSubRows(visibleIncomeRows, incomeColor, incomeSectionTotal)}
            </div>
          </div>
        </div>
      )}

      {hasSaving && (
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t("charts:breakdown.saving")}
            </h3>
          </div>
          <div className="card overflow-hidden">
            <div className="divide-y divide-border">
              {renderSubRows(visibleSavingRows, savingColor, savingSectionTotal)}
            </div>
          </div>
        </div>
      )}

      {hasExcluded && (
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              {t("charts:breakdown.excluded")}
            </h3>
          </div>
          <div className="card overflow-hidden">
            <div className="divide-y divide-border">
              {renderSubRows(visibleExcludedRows, excludedColor, excludedSectionTotal, true)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

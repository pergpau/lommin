import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useDragScrollStrip } from "../../hooks/useDragScrollStrip";
import { fmtAmount } from "../../lib/format";
import { ArrowLeftIcon, ArrowRightIcon } from "../ui/icons";

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 639px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return mobile;
}

export type MonthBar = {
  key: string;
  label: string;
  income: number;
  expenses: number;
  saving: number;
};

export type ChartMode = "month" | "year";

type MonthlyChartProps = {
  bars: MonthBar[];
  activeKey: string | null;
  onSelect: (key: string) => void;
  mode: ChartMode;
  onModeChange: (mode: ChartMode) => void;
};

type StatBlockProps = {
  label: string;
  value: number;
  avg: number;
  valueClassName: string;
};

function StatBlock({ label, value, avg, valueClassName }: StatBlockProps) {
  const { t } = useTranslation("charts");
  return (
    <div className="w-24 sm:w-32 text-left">
      <div className="text-[11px] sm:text-xs text-muted uppercase tracking-wider mb-0.5 sm:mb-1">
        {label}
      </div>
      <div className={`text-lg sm:text-2xl font-semibold tabular-nums whitespace-nowrap ${valueClassName}`}>
        {fmtAmount(value, undefined, 0)}
      </div>
      <div className="text-[11px] sm:text-xs text-muted mt-0.5">
        {t("monthly.avg", { amount: fmtAmount(avg, undefined, 0) })}
      </div>
    </div>
  );
}

type StatsRowProps = {
  children: ReactNode;
  modeToggle: ReactNode;
};

function StatsRow({ children, modeToggle }: StatsRowProps) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div className="flex-1 flex">
        <div className="flex w-full justify-between sm:w-auto sm:justify-start sm:gap-6">{children}</div>
      </div>
      <div className="hidden sm:block shrink-0">{modeToggle}</div>
    </div>
  );
}

const BAR_MAX = 80;
const VISIBLE_BARS = 6;
const VISIBLE_BARS_MOBILE = 3;
// Width reserved at the strip edges so the neighboring bars peek in under the fade.
const PEEK_PX = 40;

function barStyle(height: number, color: string): CSSProperties {
  return {
    height: `${height}px`,
    width: "14px",
    borderRadius: "3px 3px 0 0",
    backgroundColor: color,
    transition: "background-color 0.15s, height 0.25s ease",
  };
}

export default function MonthlyChart({
  bars,
  activeKey,
  onSelect,
  mode,
  onModeChange,
}: MonthlyChartProps) {
  const { t } = useTranslation("charts");
  const isMobile = useIsMobile();
  const visibleCount = isMobile ? VISIBLE_BARS_MOBILE : VISIBLE_BARS;
  const { scrollView, scrollByPage, stripProps } = useDragScrollStrip(bars.length, {
    anchorKey: `${mode}:${visibleCount}`,
    peekPx: PEEK_PX,
  });

  const barBasis = (n = 1) => `calc((100% - ${PEEK_PX}px) / ${visibleCount} * ${n})`;

  const selected = bars.find((b) => b.key === activeKey) ?? bars[bars.length - 1];
  const avgIncome = bars.length > 0 ? bars.reduce((s, b) => s + b.income, 0) / bars.length : 0;
  const avgExpenses = bars.length > 0 ? bars.reduce((s, b) => s + b.expenses, 0) / bars.length : 0;
  const avgSaving =
    bars.length > 0 ? bars.reduce((s, b) => s + (b.saving ?? 0), 0) / bars.length : 0;
  const scaleBars = bars.slice(scrollView.first, scrollView.last + 1);
  const maxBarVal = Math.max(
    ...scaleBars.map((b) => Math.max(b.income, b.expenses, b.saving ?? 0)),
    1,
  );

  const yearGroups: { year: string; months: MonthBar[] }[] = [];
  if (mode === "month") {
    for (const bar of bars) {
      const year = bar.key.slice(0, 4);
      const last = yearGroups[yearGroups.length - 1];
      if (last && last.year === year) last.months.push(bar);
      else yearGroups.push({ year, months: [bar] });
    }
  }

  const renderBarGraphic = (b: MonthBar, isActive: boolean) => {
    const incomeH = Math.max(2, Math.round((b.income / maxBarVal) * BAR_MAX));
    const expenseH = Math.max(2, Math.round((b.expenses / maxBarVal) * BAR_MAX));
    const savingH =
      (b.saving ?? 0) > 0 ? Math.max(2, Math.round(((b.saving ?? 0) / maxBarVal) * BAR_MAX)) : 0;
    return (
      <>
        <div className="flex items-end gap-1 justify-center" style={{ height: `${BAR_MAX}px` }}>
          <div
            style={barStyle(
              incomeH,
              isActive ? "rgb(var(--c-positive))" : "rgb(var(--c-positive) / 0.18)",
            )}
          />
          {savingH > 0 && (
            <div style={barStyle(savingH, isActive ? "#8b3eb8" : "rgba(139,62,184,0.18)")} />
          )}
          <div
            style={barStyle(
              expenseH,
              isActive ? "rgb(var(--c-negative))" : "rgb(var(--c-negative) / 0.18)",
            )}
          />
        </div>
        <div
          className={`text-[9px] font-medium mt-2 leading-tight text-center ${isActive ? "text-text" : "text-muted"}`}
        >
          {b.label}
        </div>
      </>
    );
  };

  const renderBar = (b: MonthBar, style?: CSSProperties) => (
    <button
      key={b.key}
      className="flex-1 flex flex-col items-center focus:outline-none cursor-pointer min-w-0"
      style={style}
      onClick={() => onSelect(b.key)}
    >
      {renderBarGraphic(b, b.key === activeKey)}
    </button>
  );

  const modeToggle = (
    <div className="flex rounded-lg overflow-hidden border border-border text-xs font-medium shrink-0">
      <button
        className={`px-3 py-1 transition-colors ${mode === "month" ? "bg-accent text-white" : "text-muted hover:text-text"}`}
        onClick={() => onModeChange("month")}
      >
        {t("monthly.months")}
      </button>
      <button
        className={`px-3 py-1 transition-colors ${mode === "year" ? "bg-accent text-white" : "text-muted hover:text-text"}`}
        onClick={() => onModeChange("year")}
      >
        {t("monthly.years")}
      </button>
    </div>
  );

  return (
    <div className="card p-5">
      {/* Mobile: filter above stats */}
      <div className="flex justify-end mb-3 sm:hidden">{modeToggle}</div>

      <StatsRow modeToggle={modeToggle}>
          <StatBlock label={t("monthly.income")} value={selected?.income ?? 0} avg={avgIncome} valueClassName="text-positive" />
          <StatBlock label={t("monthly.saving")} value={selected?.saving ?? 0} avg={avgSaving} valueClassName="text-[#8b3eb8]" />
          <StatBlock label={t("monthly.expenses")} value={selected?.expenses ?? 0} avg={avgExpenses} valueClassName="text-negative" />
        </StatsRow>

      <div className="flex items-center gap-1">
        {!isMobile && (
          <button
            className="shrink-0 p-2 rounded-lg text-muted hover:text-text hover:bg-surface disabled:opacity-20 disabled:cursor-default transition-colors"
            onClick={() => scrollByPage(-1)}
            disabled={scrollView.atStart}
            aria-label={t("monthly.prevAria")}
          >
            <ArrowLeftIcon size={22} />
          </button>
        )}

        <div
          {...stripProps}
          className="flex-1 overflow-x-auto no-scrollbar overscroll-x-contain select-none cursor-grab active:cursor-grabbing"
        >
          {mode === "month" ? (
            <div className="flex gap-3">
              {yearGroups.map(({ year, months }) => (
                <div
                  key={year}
                  className="flex flex-col min-w-0"
                  style={{ flex: `${months.length} 0 ${barBasis(months.length)}` }}
                >
                  <div className="flex items-end w-full">{months.map((b) => renderBar(b))}</div>
                  <div className="text-[10px] text-muted font-medium mt-2 text-center border-t border-border pt-1 w-full">
                    {year}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-end">
              {bars.map((b) => renderBar(b, { flex: `1 0 ${barBasis()}` }))}
            </div>
          )}
        </div>

        {!isMobile && (
          <button
            className="shrink-0 p-2 rounded-lg text-muted hover:text-text hover:bg-surface disabled:opacity-20 disabled:cursor-default transition-colors"
            onClick={() => scrollByPage(1)}
            disabled={scrollView.atEnd}
            aria-label={t("monthly.nextAria")}
          >
            <ArrowRightIcon size={22} />
          </button>
        )}
      </div>

    </div>
  );
}

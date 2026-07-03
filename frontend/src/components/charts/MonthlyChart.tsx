import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
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
const PAGE_SIZE = 6;
const PAGE_SIZE_MOBILE = 3;

export default function MonthlyChart({
  bars,
  activeKey,
  onSelect,
  mode,
  onModeChange,
}: MonthlyChartProps) {
  const { t } = useTranslation("charts");
  const isMobile = useIsMobile();
  const pageSize = isMobile ? PAGE_SIZE_MOBILE : PAGE_SIZE;
  const [windowStart, setWindowStart] = useState(() => Math.max(0, bars.length - pageSize));
  const navDirection = useRef<"back" | "forward" | null>(null);

  useEffect(() => {
    navDirection.current = null;
    setWindowStart(Math.max(0, bars.length - pageSize));
  }, [bars.length, pageSize]);

  const goTo = (start: number, dir: "back" | "forward") => {
    navDirection.current = dir;
    setWindowStart(Math.max(0, Math.min(bars.length - pageSize, start)));
  };

  const paged = mode === "month" || isMobile;
  const visibleBars = paged ? bars.slice(windowStart, windowStart + pageSize) : bars;
  const canGoBack = windowStart > 0;
  const canGoForward = windowStart + pageSize < bars.length;
  const prevPeek = paged && canGoBack ? bars[windowStart - 1] : null;
  const nextPeek = paged && canGoForward ? bars[windowStart + pageSize] : null;
  const selected = bars.find((b) => b.key === activeKey) ?? bars[bars.length - 1];
  const avgIncome = bars.length > 0 ? bars.reduce((s, b) => s + b.income, 0) / bars.length : 0;
  const avgExpenses = bars.length > 0 ? bars.reduce((s, b) => s + b.expenses, 0) / bars.length : 0;
  const avgSaving =
    bars.length > 0 ? bars.reduce((s, b) => s + (b.saving ?? 0), 0) / bars.length : 0;
  const scaleBars = [prevPeek, ...visibleBars, nextPeek].filter((b) => b !== null);
  const maxBarVal = Math.max(
    ...scaleBars.map((b) => Math.max(b.income, b.expenses, b.saving ?? 0)),
    1,
  );

  const animClass =
    navDirection.current === "forward"
      ? "animate-slide-in-left"
      : navDirection.current === "back"
        ? "animate-slide-in-right"
        : "";

  const yearGroups: { year: string; months: MonthBar[] }[] = [];
  if (mode === "month") {
    for (const bar of visibleBars) {
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
            style={{
              height: `${incomeH}px`,
              width: "14px",
              borderRadius: "3px 3px 0 0",
              backgroundColor: isActive ? "rgb(var(--c-positive))" : "rgb(var(--c-positive) / 0.18)",
              transition: "background-color 0.15s",
            }}
          />
          {savingH > 0 && (
            <div
              style={{
                height: `${savingH}px`,
                width: "14px",
                borderRadius: "3px 3px 0 0",
                backgroundColor: isActive ? "#8b3eb8" : "rgba(139,62,184,0.18)",
                transition: "background-color 0.15s",
              }}
            />
          )}
          <div
            style={{
              height: `${expenseH}px`,
              width: "14px",
              borderRadius: "3px 3px 0 0",
              backgroundColor: isActive ? "rgb(var(--c-negative))" : "rgb(var(--c-negative) / 0.18)",
              transition: "background-color 0.15s",
            }}
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

  const renderBar = (b: MonthBar) => (
    <button
      key={b.key}
      className="flex-1 flex flex-col items-center focus:outline-none cursor-pointer min-w-0"
      onClick={() => onSelect(b.key)}
    >
      {renderBarGraphic(b, b.key === activeKey)}
    </button>
  );

  const renderPeekBar = (b: MonthBar, side: "left" | "right") => {
    const fade =
      side === "left"
        ? "linear-gradient(to right, transparent, black)"
        : "linear-gradient(to left, transparent, black)";
    return (
      <button
        key={b.key}
        className={`w-5 shrink-0 flex flex-col ${side === "left" ? "items-end" : "items-start"} focus:outline-none cursor-pointer opacity-60`}
        style={{
          maskImage: fade,
          WebkitMaskImage: fade,
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
        }}
        onClick={() => goTo(side === "left" ? windowStart - 1 : windowStart + 1, side === "left" ? "back" : "forward")}
        aria-label={b.label}
      >
        {renderBarGraphic(b, b.key === activeKey)}
        {mode === "month" && (
          <div className="invisible text-[10px] font-medium mt-2 border-t pt-1">0</div>
        )}
      </button>
    );
  };

  const modeToggle = (
    <div className="flex rounded-lg overflow-hidden border border-border text-xs font-medium shrink-0">
      <button
        className={`px-3 py-1 transition-colors ${mode === "month" ? "bg-accent text-white" : "text-muted hover:text-text"}`}
        onClick={() => {
          navDirection.current = null;
          onModeChange("month");
        }}
      >
        {t("monthly.months")}
      </button>
      <button
        className={`px-3 py-1 transition-colors ${mode === "year" ? "bg-accent text-white" : "text-muted hover:text-text"}`}
        onClick={() => {
          navDirection.current = null;
          onModeChange("year");
        }}
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
        {(mode === "month" || isMobile) && (
          <button
            className="shrink-0 p-2 rounded-lg text-muted hover:text-text hover:bg-surface disabled:opacity-20 disabled:cursor-default transition-colors"
            onClick={() => goTo(windowStart - pageSize, "back")}
            disabled={!canGoBack}
            aria-label={t("monthly.prevAria")}
          >
            <ArrowLeftIcon size={22} />
          </button>
        )}

        <div className="flex-1 overflow-hidden">
          {mode === "month" ? (
            <div key={windowStart} className={`flex gap-3 w-full ${animClass}`}>
              {prevPeek && renderPeekBar(prevPeek, "left")}
              {yearGroups.map(({ year, months }) => (
                <div key={year} className="flex flex-col min-w-0" style={{ flex: months.length }}>
                  <div className="flex items-end w-full">{months.map((b) => renderBar(b))}</div>
                  <div className="text-[10px] text-muted font-medium mt-2 text-center border-t border-border pt-1 w-full">
                    {year}
                  </div>
                </div>
              ))}
              {nextPeek && renderPeekBar(nextPeek, "right")}
            </div>
          ) : (
            <div key={windowStart} className={`flex items-end w-full ${animClass}`}>
              {prevPeek && renderPeekBar(prevPeek, "left")}
              {visibleBars.map((b) => renderBar(b))}
              {nextPeek && renderPeekBar(nextPeek, "right")}
            </div>
          )}
        </div>

        {(mode === "month" || isMobile) && (
          <button
            className="shrink-0 p-2 rounded-lg text-muted hover:text-text hover:bg-surface disabled:opacity-20 disabled:cursor-default transition-colors"
            onClick={() => goTo(windowStart + pageSize, "forward")}
            disabled={!canGoForward}
            aria-label={t("monthly.nextAria")}
          >
            <ArrowRightIcon size={22} />
          </button>
        )}
      </div>

    </div>
  );
}

import { useEffect, useState } from "react";
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
  const isMobile = useIsMobile();
  const pageSize = isMobile ? PAGE_SIZE_MOBILE : PAGE_SIZE;
  const [windowStart, setWindowStart] = useState(() => Math.max(0, bars.length - pageSize));

  useEffect(() => {
    setWindowStart(Math.max(0, bars.length - pageSize));
  }, [bars.length, pageSize]);

  const visibleBars =
    mode === "month"
      ? bars.slice(windowStart, windowStart + pageSize)
      : isMobile
        ? bars.slice(-3)
        : bars;
  const selected = bars.find((b) => b.key === activeKey) ?? bars[bars.length - 1];
  const avgIncome = bars.length > 0 ? bars.reduce((s, b) => s + b.income, 0) / bars.length : 0;
  const avgExpenses = bars.length > 0 ? bars.reduce((s, b) => s + b.expenses, 0) / bars.length : 0;
  const avgSaving =
    bars.length > 0 ? bars.reduce((s, b) => s + (b.saving ?? 0), 0) / bars.length : 0;
  const maxBarVal = Math.max(
    ...visibleBars.map((b) => Math.max(b.income, b.expenses, b.saving ?? 0)),
    1,
  );

  const canGoBack = windowStart > 0;
  const canGoForward = windowStart + pageSize < bars.length;

  const yearGroups: { year: string; months: MonthBar[] }[] = [];
  if (mode === "month") {
    for (const bar of visibleBars) {
      const year = bar.key.slice(0, 4);
      const last = yearGroups[yearGroups.length - 1];
      if (last && last.year === year) last.months.push(bar);
      else yearGroups.push({ year, months: [bar] });
    }
  }

  const renderBar = (b: MonthBar) => {
    const isActive = b.key === activeKey;
    const incomeH = Math.max(2, Math.round((b.income / maxBarVal) * BAR_MAX));
    const expenseH = Math.max(2, Math.round((b.expenses / maxBarVal) * BAR_MAX));
    const savingH =
      (b.saving ?? 0) > 0 ? Math.max(2, Math.round(((b.saving ?? 0) / maxBarVal) * BAR_MAX)) : 0;
    return (
      <button
        key={b.key}
        className="flex-1 flex flex-col items-center focus:outline-none cursor-pointer min-w-0"
        onClick={() => onSelect(b.key)}
      >
        <div className="flex items-end gap-1 justify-center" style={{ height: `${BAR_MAX}px` }}>
          <div
            style={{
              height: `${incomeH}px`,
              width: "14px",
              borderRadius: "3px 3px 0 0",
              backgroundColor: isActive ? "#22c55e" : "rgba(34,197,94,0.18)",
              transition: "background-color 0.15s",
            }}
          />
          {savingH > 0 && (
            <div
              style={{
                height: `${savingH}px`,
                width: "14px",
                borderRadius: "3px 3px 0 0",
                backgroundColor: isActive ? "#7c3aed" : "rgba(124,58,237,0.18)",
                transition: "background-color 0.15s",
              }}
            />
          )}
          <div
            style={{
              height: `${expenseH}px`,
              width: "14px",
              borderRadius: "3px 3px 0 0",
              backgroundColor: isActive ? "#ef4444" : "rgba(239,68,68,0.18)",
              transition: "background-color 0.15s",
            }}
          />
        </div>
        <div
          className={`text-[9px] font-medium mt-2 leading-tight text-center ${isActive ? "text-text" : "text-muted"}`}
        >
          {b.label}
        </div>
      </button>
    );
  };

  const modeToggle = (
    <div className="flex rounded-lg overflow-hidden border border-border text-xs font-medium shrink-0">
      <button
        className={`px-3 py-1 transition-colors ${mode === "month" ? "bg-accent text-white" : "text-muted hover:text-text"}`}
        onClick={() => onModeChange("month")}
      >
        Måneder
      </button>
      <button
        className={`px-3 py-1 transition-colors ${mode === "year" ? "bg-accent text-white" : "text-muted hover:text-text"}`}
        onClick={() => onModeChange("year")}
      >
        År
      </button>
    </div>
  );

  return (
    <div className="card p-5">
      {/* Mobile: filter above stats */}
      <div className="flex justify-end mb-3 sm:hidden">{modeToggle}</div>

      <div className="flex items-start justify-between mb-5">
        <div className="flex gap-6">
          <div>
            <div className="text-xs text-muted uppercase tracking-wider mb-1">Inntekt</div>
            <div className="text-2xl font-semibold text-positive">
              {fmtAmount(selected?.income ?? 0, undefined, 0)}
            </div>
            <div className="text-xs text-muted mt-0.5">
              Snitt: {fmtAmount(avgIncome, undefined, 0)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted uppercase tracking-wider mb-1">Sparing</div>
            <div className="text-2xl font-semibold" style={{ color: "#7c3aed" }}>
              {fmtAmount(selected?.saving ?? 0, undefined, 0)}
            </div>
            <div className="text-xs text-muted mt-0.5">
              Snitt: {fmtAmount(avgSaving, undefined, 0)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted uppercase tracking-wider mb-1">Utgifter</div>
            <div className="text-2xl font-semibold text-negative">
              {fmtAmount(selected?.expenses ?? 0, undefined, 0)}
            </div>
            <div className="text-xs text-muted mt-0.5">
              Snitt: {fmtAmount(avgExpenses, undefined, 0)}
            </div>
          </div>
        </div>
        {/* Desktop: filter beside stats */}
        <div className="hidden sm:block">{modeToggle}</div>
      </div>

      <div className="flex items-center gap-1">
        {mode === "month" && (
          <button
            className="shrink-0 p-2 rounded-lg text-muted hover:text-text hover:bg-surface disabled:opacity-20 disabled:cursor-default transition-colors"
            onClick={() => setWindowStart(Math.max(0, windowStart - pageSize))}
            disabled={!canGoBack}
            aria-label="Forrige"
          >
            <ArrowLeftIcon size={22} />
          </button>
        )}

        <div className="flex-1 overflow-hidden">
          {mode === "month" ? (
            <div className="flex gap-3 w-full">
              {yearGroups.map(({ year, months }) => (
                <div key={year} className="flex flex-col min-w-0" style={{ flex: months.length }}>
                  <div className="flex items-end w-full">{months.map((b) => renderBar(b))}</div>
                  <div className="text-[10px] text-muted font-medium mt-2 text-center border-t border-border pt-1 w-full">
                    {year}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-end w-full">
              {(isMobile ? bars.slice(-3) : bars).map((b) => renderBar(b))}
            </div>
          )}
        </div>

        {mode === "month" && (
          <button
            className="shrink-0 p-2 rounded-lg text-muted hover:text-text hover:bg-surface disabled:opacity-20 disabled:cursor-default transition-colors"
            onClick={() =>
              setWindowStart(Math.min(bars.length - pageSize, windowStart + pageSize))
            }
            disabled={!canGoForward}
            aria-label="Neste"
          >
            <ArrowRightIcon size={22} />
          </button>
        )}
      </div>
    </div>
  );
}

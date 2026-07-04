import { useTranslation } from "react-i18next";
import { getLocale } from "../lib/i18n";

interface Props {
  days: number;
  onDaysChange: (days: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ResyncModal({ days, onDaysChange, onConfirm, onCancel }: Props) {
  const { t } = useTranslation("account");

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm mx-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-text mb-1">{t("resync.title")}</h3>
        <p className="text-xs text-muted mb-5">{t("resync.description")}</p>
        <div className="mb-5">
          <div className="flex justify-between text-xs text-muted mb-2">
            <span>{t("resync.daysLabel", { count: days })}</span>
            <span className="mono">
              {(() => {
                const d = new Date();
                d.setDate(d.getDate() - days);
                return d.toLocaleDateString(getLocale());
              })()}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={90}
            value={days}
            onChange={(e) => onDaysChange(Number(e.target.value))}
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-[10px] text-muted mt-1">
            <span>1</span>
            <span>90</span>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            className="px-3 py-1.5 text-sm text-muted hover:text-text transition-colors"
            onClick={onCancel}
          >
            {t("resync.cancel")}
          </button>
          <button
            className="px-3 py-1.5 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
            onClick={onConfirm}
          >
            {t("resync.action")}
          </button>
        </div>
      </div>
    </div>
  );
}

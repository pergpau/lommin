import { faPenToSquare, faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useTranslation } from "react-i18next";

interface BulkActionBarProps {
  count: number;
  onEdit: () => void;
  onClose: () => void;
}

export default function BulkActionBar({ count, onEdit, onClose }: BulkActionBarProps) {
  const { t } = useTranslation("transactions");
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 w-full sm:bottom-6 sm:left-1/2 sm:inset-x-auto sm:-translate-x-1/2 sm:w-[calc(100%-2rem)] sm:max-w-md">
      <div className="bg-surface-2 border-t sm:border border-border-2 rounded-t-2xl sm:rounded-2xl shadow-2xl px-4 py-4 sm:py-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-3 flex items-center gap-3">
        <button
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-text transition-colors"
          onClick={onClose}
          aria-label={t("bulk.done")}
        >
          <FontAwesomeIcon icon={faXmark} className="w-5 h-5" />
        </button>
        <span className="text-sm font-semibold text-text tabular-nums">
          {t("bulk.selected", { count })}
        </span>
        <div className="flex-1" />
        <button
          className="flex items-center gap-2 rounded-lg bg-accent hover:bg-accent-dim text-white px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none"
          onClick={onEdit}
          disabled={count === 0}
        >
          <FontAwesomeIcon icon={faPenToSquare} className="w-4 h-4" />
          {t("bulk.edit")}
        </button>
      </div>
    </div>
  );
}

import { useTranslation } from "react-i18next";

interface DeleteConfirmModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteConfirmModal({ open, onCancel, onConfirm }: DeleteConfirmModalProps) {
  const { t } = useTranslation("transactions");
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm mx-4 shadow-xl p-6 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-text">{t("detail.deleteConfirmTitle")}</h2>
        <p className="text-xs text-muted leading-relaxed">{t("detail.deleteConfirmBody")}</p>
        <div className="flex gap-2 justify-end">
          <button className="btn-ghost text-sm px-4 py-1.5" onClick={onCancel}>
            {t("detail.deleteConfirmCancel")}
          </button>
          <button
            className="text-sm px-4 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
            onClick={onConfirm}
          >
            {t("detail.deleteConfirmOk")}
          </button>
        </div>
      </div>
    </div>
  );
}

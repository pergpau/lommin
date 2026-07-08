import { useTranslation } from "react-i18next";
import Modal from "./Modal";

interface DeleteConfirmModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title?: string;
  body?: string;
}

export default function DeleteConfirmModal({
  open,
  onCancel,
  onConfirm,
  title,
  body,
}: DeleteConfirmModalProps) {
  const { t } = useTranslation("transactions");
  if (!open) return null;
  return (
    <Modal onClose={onCancel} elevated panelClassName="max-w-sm p-6 flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-text">{title ?? t("detail.deleteConfirmTitle")}</h2>
      <p className="text-xs text-muted leading-relaxed">{body ?? t("detail.deleteConfirmBody")}</p>
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
    </Modal>
  );
}

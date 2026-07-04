import { useTranslation } from "react-i18next";
import Button from "./ui/Button";

export default function DriveRestoreWarningModal({
  backupCount,
  localCount,
  onConfirm,
  onCancel,
}: {
  backupCount: number;
  localCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation("common");
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-surface border border-border rounded-xl p-6 w-full max-w-sm mx-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-text mb-1">{t("restoreWarning.title")}</h3>
        <p className="text-xs text-muted mb-3">
          {t("restoreWarning.body", { backupCount, localCount })}
        </p>
        <div className="border border-warning/20 bg-warning/5 rounded-lg p-3 mb-4">
          <p className="text-xs text-warning leading-relaxed">{t("restoreWarning.consequence")}</p>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onCancel}>
            {t("restoreWarning.keepLocal")}
          </Button>
          <Button onClick={onConfirm}>{t("restoreWarning.confirm")}</Button>
        </div>
      </div>
    </div>
  );
}

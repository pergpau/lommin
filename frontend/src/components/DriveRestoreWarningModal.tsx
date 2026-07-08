import { useTranslation } from "react-i18next";
import Button from "./ui/Button";
import Modal from "./ui/Modal";

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
    <Modal onClose={onCancel} title={t("restoreWarning.title")}>
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
    </Modal>
  );
}

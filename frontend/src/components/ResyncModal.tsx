import { useTranslation } from "react-i18next";
import { getLocale } from "../lib/i18n";
import Button from "./ui/Button";
import Modal from "./ui/Modal";
import ModalActions from "./ui/ModalActions";

interface Props {
  days: number;
  onDaysChange: (days: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ResyncModal({ days, onDaysChange, onConfirm, onCancel }: Props) {
  const { t } = useTranslation("account");

  return (
    <Modal onClose={onCancel} title={t("resync.title")}>
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
      <ModalActions>
        <Button variant="ghost" onClick={onCancel}>
          {t("resync.cancel")}
        </Button>
        <Button onClick={onConfirm}>{t("resync.action")}</Button>
      </ModalActions>
    </Modal>
  );
}

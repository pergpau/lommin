import { useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "./Button";
import Input from "./Input";
import Modal from "./Modal";

interface PassphraseDialogProps {
  title: string;
  hint: string;
  actionLabel: string;
  placeholder?: string;
  onSubmit: (passphrase: string) => void;
  onClose: () => void;
}

export default function PassphraseDialog({
  title,
  hint,
  actionLabel,
  placeholder,
  onSubmit,
  onClose,
}: PassphraseDialogProps) {
  const { t } = useTranslation("common");
  const [passphrase, setPassphrase] = useState("");

  return (
    <Modal onClose={onClose} title={title}>
      <p className="text-xs text-muted mb-4">{hint}</p>
      <Input
        label={t("dialog.passwordLabel")}
        type="password"
        placeholder={placeholder ?? t("dialog.passwordPlaceholder")}
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit(passphrase);
          if (e.key === "Escape") onClose();
        }}
        className="mb-4"
        autoFocus
      />
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={onClose}>
          {t("actions.cancel")}
        </Button>
        <Button onClick={() => onSubmit(passphrase)}>{actionLabel}</Button>
      </div>
    </Modal>
  );
}

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "./ui/Button";
import Modal from "./ui/Modal";
import { clearDriveToken, persistDriveToken } from "../lib/settings";
import { signInWithGoogle } from "../lib/googleDrive";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export default function DriveReconnectModal() {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handle = () => setOpen(true);
    window.addEventListener("lommin:drive-auth-expired", handle);
    return () => window.removeEventListener("lommin:drive-auth-expired", handle);
  }, []);

  const dismiss = useCallback(() => {
    setOpen(false);
    setError(null);
    void clearDriveToken();
  }, []);

  const reconnect = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) return;
    setConnecting(true);
    setError(null);
    try {
      const { token, expiresIn } = await signInWithGoogle(GOOGLE_CLIENT_ID);
      await persistDriveToken(token, expiresIn);
      window.dispatchEvent(new Event("lommin:drive-token-updated"));
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("driveReconnect.error"));
    } finally {
      setConnecting(false);
    }
  }, [t]);

  if (!open) return null;

  return (
    <Modal onClose={dismiss} title={t("driveReconnect.title")}>
      <p className="text-xs text-muted mb-4">{t("driveReconnect.body")}</p>
      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" onClick={dismiss}>
          {t("actions.cancel")}
        </Button>
        {GOOGLE_CLIENT_ID && (
          <Button loading={connecting} onClick={() => void reconnect()}>
            {t("driveReconnect.reconnect")}
          </Button>
        )}
      </div>
    </Modal>
  );
}

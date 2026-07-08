import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Modal from "../ui/Modal";
import { useSnackbar } from "../ui/Snackbar";
import { clearKey } from "../../lib/auth";
import { clearDismissedPairs, clearDriveToken } from "../../lib/settings";
import { clearAccounts, clearTransactions } from "../../lib/data";

export default function DangerZone() {
  const { t } = useTranslation(["settings", "common"]);
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();
  const [wiping, setWiping] = useState(false);
  const [wipingAccounts, setWipingAccounts] = useState(false);
  const [wipingAll, setWipingAll] = useState(false);
  const [wipeAllDialog, setWipeAllDialog] = useState(false);

  const wipeTransactions = useCallback(async () => {
    if (!confirm(t("settings:danger.confirmDeleteTransactions"))) return;
    setWiping(true);
    try {
      await clearTransactions();
      await clearDismissedPairs();
      showSnackbar(t("settings:snackbar.txDeleted"), "ok");
    } catch (e) {
      showSnackbar(e instanceof Error ? e.message : t("settings:snackbar.deleteFailed"), "error");
    } finally {
      setWiping(false);
    }
  }, [showSnackbar, t]);

  const wipeAccounts = useCallback(async () => {
    if (!confirm(t("settings:danger.confirmDeleteAccounts"))) return;
    setWipingAccounts(true);
    try {
      await clearTransactions();
      await clearAccounts();
      await clearDismissedPairs();
      showSnackbar(t("settings:snackbar.accountsDeleted"), "ok");
    } catch (e) {
      showSnackbar(e instanceof Error ? e.message : t("settings:snackbar.deleteFailed"), "error");
    } finally {
      setWipingAccounts(false);
    }
  }, [showSnackbar, t]);

  const wipeAll = useCallback(async () => {
    setWipeAllDialog(false);
    setWipingAll(true);
    try {
      await clearTransactions();
      await clearAccounts();
      await clearKey();
      await clearDriveToken();
      await clearDismissedPairs();
      navigate("/onboarding");
    } catch (e) {
      showSnackbar(e instanceof Error ? e.message : t("settings:snackbar.deleteFailed"), "error");
      setWipingAll(false);
    }
  }, [navigate, showSnackbar, t]);

  return (
    <>
      <Card className="p-5 border-negative/10">
        <h2 className="text-sm font-semibold text-text mb-1">{t("settings:danger.title")}</h2>
        <div className="flex gap-2 flex-wrap">
          <Button variant="danger" loading={wiping} onClick={wipeTransactions}>
            {t("settings:danger.deleteTransactions")}
          </Button>
          <Button variant="danger" loading={wipingAccounts} onClick={wipeAccounts}>
            {t("settings:danger.deleteAccounts")}
          </Button>
          <Button variant="danger" loading={wipingAll} onClick={() => setWipeAllDialog(true)}>
            {t("settings:danger.deleteAll")}
          </Button>
        </div>
      </Card>

      {wipeAllDialog && (
        <Modal onClose={() => setWipeAllDialog(false)} title={t("settings:danger.wipeAllTitle")}>
          <p className="text-xs text-muted mb-6">{t("settings:danger.wipeAllBody")}</p>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setWipeAllDialog(false)}>
              {t("common:actions.cancel")}
            </Button>
            <Button variant="danger" onClick={wipeAll}>
              {t("settings:danger.deleteAll")}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

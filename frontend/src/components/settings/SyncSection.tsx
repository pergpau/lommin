import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Input from "../ui/Input";
import { useSnackbar } from "../ui/Snackbar";
import { getSetting, setSetting } from "../../lib/settings";

export default function SyncSection() {
  const { t } = useTranslation(["settings", "common"]);
  const { showSnackbar } = useSnackbar();
  const [lookbackDays, setLookbackDays] = useState("");
  const [savingLookback, setSavingLookback] = useState(false);

  useEffect(() => {
    getSetting("lookbackDays").then((d) => setLookbackDays(String(d)));
  }, []);

  const saveLookback = useCallback(async () => {
    setSavingLookback(true);
    try {
      await setSetting("lookbackDays", parseInt(lookbackDays, 10));
      showSnackbar(t("settings:snackbar.syncPeriodSaved"), "ok");
    } catch (e) {
      showSnackbar(e instanceof Error ? e.message : t("settings:snackbar.saveFailed"), "error");
    } finally {
      setSavingLookback(false);
    }
  }, [lookbackDays, showSnackbar, t]);

  return (
    <Card className="p-5 mb-4">
      <h2 className="text-sm font-semibold text-text mb-1">{t("settings:sync.title")}</h2>
      <p className="text-xs text-muted mb-3">{t("settings:sync.description")}</p>
      <div className="flex gap-2">
        <Input
          label={t("settings:sync.lookbackLabel")}
          type="number"
          min={1}
          max={3650}
          value={lookbackDays}
          onChange={(e) => setLookbackDays(e.target.value)}
          className="flex-1"
        />
        <div className="self-end">
          <Button loading={savingLookback} onClick={saveLookback}>
            {t("common:actions.save")}
          </Button>
        </div>
      </div>
    </Card>
  );
}

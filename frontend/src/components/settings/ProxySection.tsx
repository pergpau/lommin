import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Input from "../ui/Input";
import { useSnackbar } from "../ui/Snackbar";
import { getSetting, setSetting } from "../../lib/settings";

export default function ProxySection() {
  const { t } = useTranslation(["settings", "common"]);
  const { showSnackbar } = useSnackbar();
  const [proxyUrl, setProxyUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSetting("proxyUrl").then(setProxyUrl);
  }, []);

  const saveProxy = useCallback(async () => {
    setSaving(true);
    try {
      await setSetting("proxyUrl", proxyUrl.trim());
      showSnackbar(t("settings:snackbar.proxySaved"), "ok");
    } catch (e) {
      showSnackbar(e instanceof Error ? e.message : t("settings:snackbar.saveFailed"), "error");
    } finally {
      setSaving(false);
    }
  }, [proxyUrl, showSnackbar, t]);

  return (
    <Card className="p-5 mb-4">
      <h2 className="text-sm font-semibold text-text mb-1">{t("settings:proxy.title")}</h2>
      <p className="text-xs text-muted mb-3">
        {t("settings:proxy.description")}
      </p>

      <div className="mb-4 border border-warning/20 bg-warning/5 rounded-lg p-3">
        <p className="text-xs text-muted leading-relaxed">
          {t("settings:proxy.warning")}
        </p>
      </div>

      <Input
        label={t("settings:proxy.urlLabel")}
        value={proxyUrl}
        onChange={(e) => setProxyUrl(e.target.value)}
        placeholder={t("settings:proxy.urlPlaceholder")}
        className="mb-2"
      />
      <Button loading={saving} onClick={saveProxy}>
        {t("common:actions.save")}
      </Button>
    </Card>
  );
}

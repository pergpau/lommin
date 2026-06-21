import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Input from "../ui/Input";
import { useSnackbar } from "../ui/Snackbar";
import { getSetting, HOSTED_PROXY_URL, setSetting } from "../../lib/settings";

export default function ProxySection() {
  const { t } = useTranslation(["settings", "common"]);
  const { showSnackbar } = useSnackbar();
  const [proxyMode, setProxyMode] = useState<"lommin" | "custom">("lommin");
  const [customProxyUrl, setCustomProxyUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSetting("proxyUrl").then((url) => {
      if (url === HOSTED_PROXY_URL) {
        setProxyMode("lommin");
      } else {
        setProxyMode("custom");
        setCustomProxyUrl(url);
      }
    });
  }, []);

  const changeProxyMode = useCallback(async (mode: "lommin" | "custom") => {
    setProxyMode(mode);
    if (mode === "lommin") {
      try {
        await setSetting("proxyUrl", HOSTED_PROXY_URL);
        showSnackbar(t("settings:snackbar.proxySet"), "ok");
      } catch (e) {
        showSnackbar(e instanceof Error ? e.message : t("settings:snackbar.saveFailed"), "error");
      }
    }
  }, [showSnackbar, t]);

  const saveProxy = useCallback(async () => {
    setSaving(true);
    try {
      await setSetting("proxyUrl", customProxyUrl.trim());
      showSnackbar(t("settings:snackbar.proxySaved"), "ok");
    } catch (e) {
      showSnackbar(e instanceof Error ? e.message : t("settings:snackbar.saveFailed"), "error");
    } finally {
      setSaving(false);
    }
  }, [customProxyUrl, showSnackbar, t]);

  return (
    <Card className="p-5 mb-4">
      <h2 className="text-sm font-semibold text-text mb-1">{t("settings:proxy.title")}</h2>
      <p className="text-xs text-muted mb-3">
        {t("settings:proxy.description")}
      </p>

      <div className="flex gap-4 mb-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="radio"
            name="proxyMode"
            value="lommin"
            checked={proxyMode === "lommin"}
            onChange={() => changeProxyMode("lommin")}
            className="w-4 h-4 accent-accent"
          />
          <span className="text-xs text-text">{t("settings:proxy.lommin")}</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="radio"
            name="proxyMode"
            value="custom"
            checked={proxyMode === "custom"}
            onChange={() => changeProxyMode("custom")}
            className="w-4 h-4 accent-accent"
          />
          <span className="text-xs text-text">{t("settings:proxy.custom")}</span>
        </label>
      </div>

      <div className="mb-4 border border-warning/20 bg-warning/5 rounded-lg p-3">
        <p className="text-xs text-muted leading-relaxed">
          {t("settings:proxy.warning")}
        </p>
      </div>

      {proxyMode === "custom" && (
        <div>
          <Input
            label={t("settings:proxy.urlLabel")}
            value={customProxyUrl}
            onChange={(e) => setCustomProxyUrl(e.target.value)}
            placeholder={t("settings:proxy.urlPlaceholder")}
            className="mb-2"
          />
          <Button loading={saving} onClick={saveProxy}>
            {t("common:actions.save")}
          </Button>
        </div>
      )}
    </Card>
  );
}

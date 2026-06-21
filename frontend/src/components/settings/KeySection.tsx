import { useCallback, useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import BankSetupGuide from "../BankSetupGuide";
import PemImporter from "../PemImporter";
import PemSafetyAccordion from "../PemSafetyAccordion";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { TrashIcon } from "../ui/icons";
import Input from "../ui/Input";
import { useSnackbar } from "../ui/Snackbar";
import { clearKey, loadKey, saveKey } from "../../lib/auth";
import { clearDriveToken } from "../../lib/settings";

export default function KeySection({ highlightedHash }: { highlightedHash: string | null }) {
  const { t } = useTranslation(["settings", "common"]);
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();
  const [hasKey, setHasKey] = useState(true);
  const [pemConfirming, setPemConfirming] = useState(false);
  const [pemAppId, setPemAppId] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const pendingPemKey = useRef<CryptoKey | null>(null);
  const [appId, setAppId] = useState("");
  const savedAppId = useRef("");
  const [savingAppId, setSavingAppId] = useState(false);

  useEffect(() => {
    loadKey().then((kv) => {
      setHasKey(!!kv);
      if (kv) {
        setAppId(kv.appId);
        savedAppId.current = kv.appId;
      }
    });
  }, []);

  const confirmPemKey = useCallback(async () => {
    if (!pendingPemKey.current || !pemAppId.trim()) return;
    try {
      await saveKey(pendingPemKey.current, pemAppId.trim());
      setAppId(pemAppId.trim());
      setHasKey(true);
      setPemConfirming(false);
    } catch (e) {
      showSnackbar(e instanceof Error ? e.message : t("settings:snackbar.saveKeyFailed"), "error");
    }
  }, [pemAppId, showSnackbar, t]);

  const saveAppIdFn = useCallback(async () => {
    const trimmed = appId.trim();
    if (!trimmed) return;
    setSavingAppId(true);
    try {
      const kv = await loadKey();
      if (!kv) throw new Error(t("settings:snackbar.noKey"));
      await saveKey(kv.key, trimmed);
      setAppId(trimmed);
      savedAppId.current = trimmed;
      showSnackbar(t("settings:snackbar.appIdUpdated"), "ok");
    } catch (e) {
      showSnackbar(e instanceof Error ? e.message : t("settings:snackbar.saveFailed"), "error");
    } finally {
      setSavingAppId(false);
    }
  }, [appId, showSnackbar, t]);

  const forgetKey = useCallback(async () => {
    await clearKey();
    await clearDriveToken();
    navigate("/onboarding");
  }, [navigate]);

  return (
    <Card id="pem" className={`p-5 mb-4 transition-shadow duration-300 ${highlightedHash === "#pem" ? "ring-2 ring-accent" : ""} ${!hasKey ? "border-accent/30 bg-accent/5" : ""}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-text">{t("settings:signingKey.title")}</h2>
          {hasKey && (
            <span className="inline-flex items-center gap-1 rounded-full bg-positive/10 px-2 py-0.5 text-xs font-medium text-positive">
              {t("settings:signingKey.imported")}
            </span>
          )}
        </div>
        {hasKey && (
          <button
            className="inline-flex items-center gap-1 text-xs text-negative/70 hover:text-negative transition-colors"
            onClick={forgetKey}
          >
            <TrashIcon size={12} />
            {t("settings:signingKey.removeKey")}
          </button>
        )}
      </div>

      {hasKey ? (
        <div className="space-y-3 mt-4">
          <div>
            <Input
              label={t("settings:appId.label")}
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveAppIdFn(); }}
              placeholder={t("settings:appId.placeholder")}
              className="w-full font-mono"
            />
          </div>
          <Button loading={savingAppId} onClick={saveAppIdFn} disabled={!appId.trim() || appId.trim() === savedAppId.current}>
            {t("settings:appId.update")}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted">
            <Trans
              i18nKey="settings:signingKey.noKey"
              components={{ pem: <span className="mono" /> }}
            />
          </p>
          {!pemConfirming ? (
            <>
              <button
                className="text-xs text-accent hover:underline"
                onClick={() => setShowGuide((v) => !v)}
              >
                {showGuide ? t("settings:signingKey.guideHide") : t("settings:signingKey.guideShow")}
              </button>
              {showGuide && (
                <div className="border border-border rounded-xl p-4 mt-1">
                  <BankSetupGuide />
                </div>
              )}
              <PemSafetyAccordion />
              <PemImporter
                onImported={async (key, id) => {
                  if (id) {
                    try {
                      await saveKey(key, id);
                      setAppId(id);
                      savedAppId.current = id;
                      setHasKey(true);
                    } catch (e) {
                      showSnackbar(e instanceof Error ? e.message : t("settings:snackbar.saveKeyFailed"), "error");
                    }
                  } else {
                    pendingPemKey.current = key;
                    setPemAppId("");
                    setPemConfirming(true);
                  }
                }}
              />
            </>
          ) : (
            <div className="space-y-3">
              <Input
                label={t("settings:appId.label")}
                value={pemAppId}
                onChange={(e) => setPemAppId(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void confirmPemKey(); }}
                className="font-mono"
                autoFocus
              />
              <Button onClick={() => void confirmPemKey()} disabled={!pemAppId.trim()}>
                {t("settings:signingKey.saveKey")}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

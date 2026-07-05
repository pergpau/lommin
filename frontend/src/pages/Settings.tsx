import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import AppearanceSection from "../components/settings/AppearanceSection";
import BackupSection from "../components/settings/BackupSection";
import DangerZone from "../components/settings/DangerZone";
import ImportSection from "../components/settings/ImportSection";
import KeySection from "../components/settings/KeySection";
import SyncSection from "../components/settings/SyncSection";
import { DEMO_ONLY } from "../constants";
import { isDemoMode } from "../lib/demoData";

export default function Settings() {
  const { t } = useTranslation("settings");
  const { hash } = useLocation();
  const [isDemo, setIsDemo] = useState<boolean | null>(null);
  const [highlightedHash, setHighlightedHash] = useState<string | null>(null);

  useEffect(() => {
    isDemoMode().then(setIsDemo);
  }, []);

  useEffect(() => {
    if (!hash || isDemo === null || isDemo) return;
    const el = document.querySelector(hash);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top, behavior: "smooth" });
    }
    setHighlightedHash(hash);
    const timer = setTimeout(() => setHighlightedHash(null), 1200);
    return () => clearTimeout(timer);
  }, [hash, isDemo]);

  if (isDemo === null && !DEMO_ONLY) return null;

  // Demo mode (runtime or the demo-only build): expose just appearance
  // (theme + language), nothing else.
  if (DEMO_ONLY || isDemo)
    return (
      <div className="w-full max-w-xl mx-auto px-4 py-8">
        <h1 className="text-xl font-semibold mb-6">{t("title")}</h1>
        <AppearanceSection />
      </div>
    );

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-xl font-semibold mb-6">{t("title")}</h1>
      <KeySection highlightedHash={highlightedHash} />
      <SyncSection />
      <BackupSection highlightedHash={highlightedHash} />
      <ImportSection highlightedHash={highlightedHash} />
      <AppearanceSection />
      <DangerZone />
    </div>
  );
}

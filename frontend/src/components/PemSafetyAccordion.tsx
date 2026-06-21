import { useTranslation } from "react-i18next";
import Accordion from "./ui/Accordion";

const ITEMS: [string, string][] = [
  ["storedLocally", "storedLocallyBody"],
  ["openSource", "openSourceBody"],
  ["networkTab", "networkTabBody"],
  ["ownProxy", "ownProxyBody"],
  ["testFirst", "testFirstBody"],
];

export default function PemSafetyAccordion() {
  const { t } = useTranslation("components");
  return (
    <Accordion label={t("pemSafety.label")}>
      <div className="space-y-3 pt-1">
        {ITEMS.map(([titleKey, bodyKey]) => (
          <div key={titleKey}>
            <div className="text-xs font-medium text-text mb-0.5">{t(`pemSafety.${titleKey}`)}</div>
            <div className="text-xs text-muted leading-relaxed">{t(`pemSafety.${bodyKey}`)}</div>
          </div>
        ))}
      </div>
    </Accordion>
  );
}

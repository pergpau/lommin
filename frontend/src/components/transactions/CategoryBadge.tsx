import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { MAIN_CATEGORY_MAP, SUB_CATEGORY_MAP } from "../../lib/categories";
import { getCategoryIcon } from "../../lib/categoryIcons";

interface CategoryBadgeProps {
  categoryId?: number;
  onClick?: () => void;
}

export default function CategoryBadge({ categoryId, onClick }: CategoryBadgeProps) {
  const { t } = useTranslation(["transactions", "categories"]);
  const subCat = categoryId != null ? SUB_CATEGORY_MAP[categoryId] : undefined;
  const mainCat = subCat ? MAIN_CATEGORY_MAP[subCat.mainCategoryId] : undefined;

  if (!subCat || !mainCat) {
    return (
      <button
        onClick={onClick}
        className="flex flex-col items-center gap-0.5 w-14 shrink-0 group"
        title={t("transactions:categoryPicker.title")}
      >
        <div className="w-8 h-8 rounded-lg border border-dashed border-text/25 group-hover:border-text/50 flex items-center justify-center text-text/35 group-hover:text-text/60 transition-colors text-base font-light leading-none">
          +
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 w-14 shrink-0 group"
      title={`${t("categories:main." + mainCat.id)} › ${t("categories:sub." + subCat.id)}`}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center transition-opacity group-hover:opacity-80"
        style={{ backgroundColor: mainCat.color + "22", color: mainCat.color, padding: "7px" }}
      >
        <FontAwesomeIcon
          icon={getCategoryIcon(subCat.id)}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
    </button>
  );
}

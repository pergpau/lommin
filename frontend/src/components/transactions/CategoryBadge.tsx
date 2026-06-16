import { MAIN_CATEGORY_MAP, SUB_CATEGORY_MAP } from "../../lib/categories";

interface CategoryBadgeProps {
  categoryId?: number;
  onClick: () => void;
}

export default function CategoryBadge({ categoryId, onClick }: CategoryBadgeProps) {
  const subCat = categoryId != null ? SUB_CATEGORY_MAP[categoryId] : undefined;
  const mainCat = subCat ? MAIN_CATEGORY_MAP[subCat.mainCategoryId] : undefined;

  if (!subCat || !mainCat) {
    return (
      <button
        onClick={onClick}
        className="flex flex-col items-center gap-0.5 w-14 shrink-0 group"
        title="Legg til kategori"
      >
        <div className="w-8 h-8 rounded-lg border border-dashed border-border group-hover:border-text/30 flex items-center justify-center text-muted/40 group-hover:text-muted transition-colors text-sm leading-none">
          +
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 w-14 shrink-0 group"
      title={`${mainCat.name} › ${subCat.name}`}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-base leading-none transition-opacity group-hover:opacity-80"
        style={{ backgroundColor: mainCat.color + "22" }}
      >
        {subCat.icon}
      </div>
    </button>
  );
}

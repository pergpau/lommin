import { useState } from "react";
import {
  MAIN_CATEGORIES,
  SUB_CATEGORY_MAP,
  TYPE_LABELS,
  type CategoryType,
  type MainCategory,
} from "../../lib/categories";

interface CategoryPickerProps {
  currentCategoryId?: number;
  onSelect: (categoryId: number | undefined) => void;
  onClose: () => void;
}

const TYPES: CategoryType[] = ["income", "expense", "saving", "exclude"];

function mainCategoriesForType(type: CategoryType | null): MainCategory[] {
  if (!type) return MAIN_CATEGORIES;
  return MAIN_CATEGORIES.filter((m) => m.subCategories.some((s) => s.type === type));
}

export default function CategoryPicker({
  currentCategoryId,
  onSelect,
  onClose,
}: CategoryPickerProps) {
  const currentSub = currentCategoryId != null ? SUB_CATEGORY_MAP[currentCategoryId] : undefined;
  const [activeType, setActiveType] = useState<CategoryType | null>(currentSub?.type ?? null);
  const [activeMainId, setActiveMainId] = useState<number | null>(
    currentSub?.mainCategoryId ?? null,
  );

  const visibleMain = mainCategoriesForType(activeType);
  const activeMain =
    activeMainId != null ? (visibleMain.find((m) => m.id === activeMainId) ?? null) : null;
  const visibleSubs = activeMain
    ? activeMain.subCategories.filter((s) => !activeType || s.type === activeType)
    : [];

  function pickMain(id: number) {
    if (activeMainId === id) {
      setActiveMainId(null);
    } else {
      setActiveMainId(id);
    }
  }

  function pickType(type: CategoryType) {
    if (activeType === type) {
      setActiveType(null);
    } else {
      setActiveType(type);
      // Clear main selection if it's no longer visible under the new type
      if (activeMainId != null) {
        const still = mainCategoriesForType(type).find((m) => m.id === activeMainId);
        if (!still) setActiveMainId(null);
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg h-[630px] max-h-[90vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="font-semibold text-text text-sm">Velg kategori</span>
          <button className="text-muted hover:text-text text-lg leading-none" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Type pills */}
        <div className="flex gap-2 px-4 py-3 border-b border-border shrink-0 overflow-x-auto">
          {TYPES.map((type) => (
            <button
              key={type}
              onClick={() => pickType(type)}
              className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors border ${
                activeType === type
                  ? "bg-accent/10 text-accent border-accent/30"
                  : "border-border text-muted hover:text-text hover:border-text/20"
              }`}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        {/* Main categories + sub-categories */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main category list */}
          <div className="w-1/2 border-r border-border overflow-y-auto">
            {visibleMain.map((m) => (
              <button
                key={m.id}
                onClick={() => pickMain(m.id)}
                className={`w-full text-left text-sm px-4 py-2.5 transition-colors flex items-center gap-2 ${
                  activeMainId === m.id
                    ? "bg-accent/10 text-accent font-medium"
                    : "text-text hover:bg-surface-2"
                }`}
              >
                <span className="text-base leading-none shrink-0">{m.icon}</span>
                {m.name}
              </button>
            ))}
          </div>

          {/* Sub-category list */}
          <div className="w-1/2 overflow-y-auto">
            {activeMain ? (
              visibleSubs.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  className={`w-full text-left text-sm px-4 py-2.5 transition-colors flex items-center gap-2 ${
                    s.id === currentCategoryId
                      ? "bg-accent/10 text-accent font-medium"
                      : "text-text hover:bg-surface-2"
                  }`}
                >
                  <span className="text-base leading-none shrink-0">{s.icon}</span>
                  {s.name}
                </button>
              ))
            ) : (
              <div className="px-4 py-4 text-xs text-muted">Velg en hovedkategori</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border shrink-0 flex justify-between items-center">
          {currentCategoryId != null ? (
            <button
              className="text-xs text-muted hover:text-red-400 transition-colors"
              onClick={() => onSelect(undefined)}
            >
              Fjern kategori
            </button>
          ) : (
            <span />
          )}
          <button className="btn-ghost text-xs px-3 py-1.5" onClick={onClose}>
            Avbryt
          </button>
        </div>
      </div>
    </div>
  );
}

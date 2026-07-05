import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faCalendar,
  faCheck,
  faChevronRight,
  faEye,
  faEyeSlash,
  faTag,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MAIN_CATEGORY_MAP, SUB_CATEGORY_MAP } from "../../lib/categories";
import { getCategoryIcon } from "../../lib/categoryIcons";
import type { Transaction } from "../../lib/data";
import { effectiveDate, fmtDate } from "../../lib/format";
import CategoryPicker from "./CategoryPicker";

// A field is present here only when the user actually changed it. The `value`
// wrapper distinguishes "cleared to undefined" from "left untouched".
export interface BulkEditChanges {
  categoryId?: { value: number | undefined };
  customDate?: { value: string };
  excludeFromCalculations?: { value: boolean };
  comment?: { value: string | undefined };
}

interface BulkEditSheetProps {
  transactions: Transaction[];
  onSave: (changes: BulkEditChanges) => void;
  onDelete: () => void;
  onClose: () => void;
}

// The value shared by every item, or `{ varies: true }` when they disagree.
type Shared<T> = { varies: false; value: T | undefined } | { varies: true };

function shared<T>(xs: T[]): Shared<T> {
  if (xs.length === 0) return { varies: false, value: undefined };
  const first = xs[0];
  return xs.every((x) => x === first) ? { varies: false, value: first } : { varies: true };
}

export default function BulkEditSheet({
  transactions,
  onSave,
  onDelete,
  onClose,
}: BulkEditSheetProps) {
  const { t } = useTranslation(["transactions", "categories"]);
  const count = transactions.length;

  const categoryCommon = useMemo(
    () => shared(transactions.map((tx) => tx.categoryId)),
    [transactions],
  );
  const dateCommon = useMemo(
    () => shared(transactions.map((tx) => effectiveDate(tx).slice(0, 10))),
    [transactions],
  );
  const excludeCommon = useMemo(
    () => shared(transactions.map((tx) => tx.excludeFromCalculations)),
    [transactions],
  );
  const commentCommon = useMemo(
    () => shared(transactions.map((tx) => tx.comment ?? "")),
    [transactions],
  );

  const [categoryDraft, setCategoryDraft] = useState<number | undefined>(
    categoryCommon.varies ? undefined : categoryCommon.value,
  );
  const [categoryDirty, setCategoryDirty] = useState(false);

  const [dateDraft, setDateDraft] = useState(dateCommon.varies ? "" : (dateCommon.value ?? ""));
  const [dateDirty, setDateDirty] = useState(false);

  const [excludeDraft, setExcludeDraft] = useState<boolean | null>(
    excludeCommon.varies ? null : (excludeCommon.value ?? false),
  );
  const [excludeDirty, setExcludeDirty] = useState(false);

  const [commentDraft, setCommentDraft] = useState(
    commentCommon.varies ? "" : (commentCommon.value ?? ""),
  );
  const [commentDirty, setCommentDirty] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const anyDirty = categoryDirty || dateDirty || excludeDirty || commentDirty;
  const variesLabel = `(${t("transactions:bulk.varies")})`;

  function handleSave() {
    const changes: BulkEditChanges = {};
    if (categoryDirty) changes.categoryId = { value: categoryDraft };
    if (dateDirty && dateDraft) changes.customDate = { value: dateDraft };
    if (excludeDirty && excludeDraft != null)
      changes.excludeFromCalculations = { value: excludeDraft };
    if (commentDirty) changes.comment = { value: commentDraft.trim() || undefined };
    onSave(changes);
  }

  function renderCategoryValue() {
    if (!categoryDirty && categoryCommon.varies) {
      return <span className="text-sm text-muted italic">{variesLabel}</span>;
    }
    const sub = categoryDraft != null ? SUB_CATEGORY_MAP[categoryDraft] : undefined;
    const main = sub ? MAIN_CATEGORY_MAP[sub.mainCategoryId] : undefined;
    if (!sub || !main) {
      return <span className="text-sm text-muted">{t("transactions:row.uncategorized")}</span>;
    }
    return (
      <span className="flex items-center gap-2 text-sm text-text">
        <FontAwesomeIcon
          icon={getCategoryIcon(sub.id)}
          className="w-3.5 h-3.5 shrink-0"
          style={{ color: main.color }}
        />
        {t("categories:sub." + sub.id)}
      </span>
    );
  }

  function renderDateValue() {
    if (!dateDirty && dateCommon.varies) {
      return <span className="text-sm text-muted italic">{variesLabel}</span>;
    }
    if (!dateDraft) return <span className="text-sm text-muted">—</span>;
    return (
      <span className="text-sm text-text">
        {fmtDate(dateDraft, { year: "numeric", month: "short", day: "numeric" })}
      </span>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[90vh] min-h-[60vh] sm:min-h-0 flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <span className="font-semibold text-accent text-sm">
            {t("transactions:bulk.editTitle", { count })}
          </span>
          <button className="text-muted hover:text-text text-lg leading-none" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 divide-y divide-border">
          <FieldRow
            icon={faTag}
            label={t("transactions:bulk.category")}
            dirty={categoryDirty}
            onClick={() => setPickerOpen(true)}
          >
            {renderCategoryValue()}
          </FieldRow>

          <FieldRow
            icon={faCalendar}
            label={t("transactions:bulk.date")}
            dirty={dateDirty}
            onClick={() => dateInputRef.current?.showPicker()}
          >
            {renderDateValue()}
          </FieldRow>

          {/* Hidden status */}
          <div className="px-4 py-3.5">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-muted text-xs">{t("transactions:bulk.statistics")}</span>
              {excludeDirty && <DirtyDot />}
            </div>
            <div className="flex gap-2">
              <SegButton
                active={excludeDraft === false}
                icon={faEye}
                label={t("transactions:bulk.show")}
                onClick={() => {
                  setExcludeDraft(false);
                  setExcludeDirty(true);
                }}
              />
              <SegButton
                active={excludeDraft === true}
                icon={faEyeSlash}
                label={t("transactions:bulk.hide")}
                onClick={() => {
                  setExcludeDraft(true);
                  setExcludeDirty(true);
                }}
              />
            </div>
            {excludeDraft === null && (
              <p className="text-xs text-muted italic mt-2">{variesLabel}</p>
            )}
          </div>

          {/* Comment */}
          <div className="px-4 py-3.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-muted text-xs">{t("transactions:bulk.comment")}</span>
              {commentDirty && <DirtyDot />}
            </div>
            {commentCommon.varies && (
              <p className="text-xs text-yellow-600 dark:text-yellow-500 leading-relaxed mb-2">
                {t("transactions:bulk.commentOverwriteWarning")}
              </p>
            )}
            <textarea
              className="w-full min-h-20 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-text resize-none focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder={
                commentCommon.varies ? variesLabel : t("transactions:detail.commentPlaceholder")
              }
              value={commentDraft}
              onChange={(e) => {
                setCommentDraft(e.target.value);
                setCommentDirty(true);
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border shrink-0 flex items-center justify-between">
          <button
            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors"
            onClick={onDelete}
          >
            <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
            {t("transactions:bulk.delete")}
          </button>
          <div className="flex items-center gap-2">
            <button className="btn-ghost text-sm px-3 py-2" onClick={onClose}>
              {t("transactions:bulk.cancel")}
            </button>
            <button
              className="text-sm px-4 py-2 rounded-lg bg-accent hover:bg-accent-dim text-white font-medium flex items-center gap-2 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              onClick={handleSave}
              disabled={!anyDirty}
            >
              <FontAwesomeIcon icon={faCheck} className="w-3.5 h-3.5" />
              {t("transactions:bulk.save")}
            </button>
          </div>
        </div>
      </div>

      {/* Hidden input driving the date field. */}
      <input
        ref={dateInputRef}
        type="date"
        className="sr-only"
        value={dateDraft}
        onChange={(e) => {
          setDateDraft(e.target.value);
          setDateDirty(true);
        }}
      />

      {pickerOpen && (
        <CategoryPicker
          currentCategoryId={categoryDraft}
          onSelect={(id) => {
            setCategoryDraft(id);
            setCategoryDirty(true);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

function FieldRow({
  icon,
  label,
  dirty,
  onClick,
  children,
}: {
  icon: IconDefinition;
  label: string;
  dirty: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2 transition-colors"
      onClick={onClick}
    >
      <FontAwesomeIcon icon={icon} className="w-4 h-4 text-muted shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted">{label}</span>
          {dirty && <DirtyDot />}
        </div>
        <div className="mt-0.5">{children}</div>
      </div>
      <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3 text-muted shrink-0" />
    </button>
  );
}

function SegButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: IconDefinition;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={
        "flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors " +
        (active
          ? "border-accent bg-accent/10 text-accent font-medium"
          : "border-border text-text hover:bg-surface-2")
      }
      onClick={onClick}
    >
      <FontAwesomeIcon icon={icon} className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function DirtyDot() {
  return <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />;
}

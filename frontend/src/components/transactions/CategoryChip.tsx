import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { TINT } from "../../lib/categories";

const SIZES = {
  sm: "w-6 h-6 rounded-md",
  md: "w-7 h-7 rounded-lg",
  lg: "w-8 h-8 rounded-lg",
} as const;

type CategoryChipProps = {
  icon: IconDefinition;
  /** 6-digit hex; tinted via TINT.bg for the background. */
  color: string;
  size?: keyof typeof SIZES;
  className?: string;
};

/** The tinted square holding a main- or sub-category icon. */
export default function CategoryChip({ icon, color, size = "md", className }: CategoryChipProps) {
  return (
    <span
      className={`${SIZES[size]} shrink-0 flex items-center justify-center${
        className ? ` ${className}` : ""
      }`}
      style={{ backgroundColor: color + TINT.bg, color }}
    >
      <FontAwesomeIcon icon={icon} className="w-3.5 h-3.5" />
    </span>
  );
}

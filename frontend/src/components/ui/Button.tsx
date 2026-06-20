import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import Spinner from "./Spinner";

type ButtonProps = {
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md";
  fullWidth?: boolean;
  loading?: boolean;
  success?: boolean;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export default function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  loading,
  success,
  children,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const variantClass =
    variant === "primary" ? "btn-primary" : variant === "ghost" ? "btn-ghost" : "btn-danger";
  const sizeClass = size === "sm" ? "text-xs px-3 py-1.5" : "";
  const widthClass = fullWidth ? "w-full justify-center" : "";
  return (
    <button
      className={`${variantClass} ${sizeClass} ${widthClass} flex items-center gap-1.5 ${className ?? ""}`.trim()}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="relative flex items-center justify-center">
          <span className="invisible flex items-center gap-1.5">{children}</span>
          <span className="absolute">
            <Spinner size={size === "sm" ? 10 : 12} />
          </span>
        </span>
      ) : success ? (
        <span className="relative flex items-center justify-center">
          <span className="invisible flex items-center gap-1.5">{children}</span>
          <span className="absolute animate-check-pop">
            <FontAwesomeIcon icon={faCheck} size={size === "sm" ? "xs" : "sm"} />
          </span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

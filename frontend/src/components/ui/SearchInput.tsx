import { useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faXmark } from "@fortawesome/free-solid-svg-icons";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export default function SearchInput({ value, onChange, placeholder, className }: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`relative flex items-center ${className ?? ""}`}
      onClick={() => inputRef.current?.focus()}
    >
      <FontAwesomeIcon
        icon={faMagnifyingGlass}
        className="absolute left-2.5 text-muted transition-colors pointer-events-none"
        style={{ fontSize: 11 }}
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-44 pl-7 pr-6 py-1.5 text-xs bg-surface border border-border rounded-md text-text placeholder:text-muted focus:outline-none focus:border-border-2 focus:ring-1 focus:ring-accent/20 transition-colors"
      />
      {value && (
        <button
          className="absolute right-2 flex items-center text-muted hover:text-text transition-colors"
          onClick={(e) => { e.stopPropagation(); onChange(""); inputRef.current?.focus(); }}
          aria-label="Clear search"
          tabIndex={-1}
        >
          <FontAwesomeIcon icon={faXmark} style={{ fontSize: 11 }} />
        </button>
      )}
    </div>
  );
}

import { useRef } from "react";
import Button from "./Button";

type FilePickerButtonProps = {
  accept: string;
  onFile: (file: File) => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  children: React.ReactNode;
};

/** A button that opens the file dialog, hiding the input it needs to do so. */
export default function FilePickerButton({
  accept,
  onFile,
  variant,
  disabled,
  children,
}: FilePickerButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Clear the value so picking the same file twice still fires onChange.
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
      <Button variant={variant} disabled={disabled} onClick={() => inputRef.current?.click()}>
        {children}
      </Button>
    </>
  );
}

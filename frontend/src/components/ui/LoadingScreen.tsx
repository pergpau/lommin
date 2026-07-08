import Spinner from "./Spinner";

type LoadingScreenProps = { label?: string; size?: number; className?: string };

export default function LoadingScreen({ label, size = 24, className }: LoadingScreenProps) {
  return (
    <div className={`flex-1 flex items-center justify-center${className ? ` ${className}` : ""}`}>
      <div className="flex flex-col items-center">
        <Spinner size={size} />
        {label && <div className="text-muted text-sm mt-4">{label}</div>}
      </div>
    </div>
  );
}

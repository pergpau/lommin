type CardProps = { children: React.ReactNode; className?: string; id?: string };

export default function Card({ children, className, id }: CardProps) {
  return (
    <div id={id} className={`card ${className ?? ""}`}>
      {children}
    </div>
  );
}

type OwlProps = {
  size?: number;
};

export function Owl({ size = 84 }: OwlProps) {
  return (
    <svg className="owl" width={size} height={size} viewBox="0 0 80 80" aria-hidden="true">
      <ellipse cx="40" cy="48" rx="22" ry="20" fill="#f4e7c8" />
      <path d="M24 28 L32 18 L36 30 Z M56 28 L48 18 L44 30 Z" fill="#f4e7c8" />
      <circle cx="40" cy="34" r="16" fill="#f4e7c8" />
      <circle cx="33" cy="34" r="6" fill="#12182b" />
      <circle cx="47" cy="34" r="6" fill="#12182b" />
      <circle cx="35" cy="32" r="1.6" fill="#ffe1a3" />
      <circle cx="49" cy="32" r="1.6" fill="#ffe1a3" />
      <path d="M37 40 L40 45 L43 40 Z" fill="#f0a202" />
      <path d="M22 50 Q16 58 24 62" fill="none" stroke="#f4e7c8" strokeWidth="3" />
      <path d="M58 50 Q64 58 56 62" fill="none" stroke="#f4e7c8" strokeWidth="3" />
    </svg>
  );
}

export function Lantern() {
  return (
    <div className="lantern" aria-hidden="true">
      <div className="flame" />
    </div>
  );
}

type LogoMarkProps = { size?: number; className?: string };

export function LogoMark({ size = 40, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="48" height="48" rx="14" fill="#0A6FA6" />
      <path d="M15 26a9 9 0 0 1 18 0Z" fill="#FFFFFF" />
      <path
        d="M9 30.5q3.75-3 7.5 0t7.5 0 7.5 0 7.5 0"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.75 37q3.75-3 7.5 0t7.5 0 7.5 0"
        fill="none"
        stroke="#8FD6F2"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type LogoProps = {
  size?: number;
  subtitle?: string;
  className?: string;
};

export function Logo({ size = 40, subtitle, className = "" }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <LogoMark size={size} />
      <span className="flex flex-col leading-none">
        <span className="font-wordmark text-2xl font-bold tracking-tight text-rimlay-blue">rimlay</span>
        {subtitle ? <span className="mt-1 text-xs text-rimlay-driftwood">{subtitle}</span> : null}
      </span>
    </span>
  );
}

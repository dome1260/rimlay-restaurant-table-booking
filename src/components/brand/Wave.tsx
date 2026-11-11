export function WaveDivider({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 80"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M0 40 C 200 0, 400 80, 600 40 S 1000 0, 1200 40 V80 H0 Z" fill="#8FD6F2" opacity="0.55" />
      <path d="M0 56 C 200 24, 400 88, 600 56 S 1000 24, 1200 56 V80 H0 Z" fill="#FFFFFF" />
    </svg>
  );
}

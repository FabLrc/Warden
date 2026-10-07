/** Stylised Warden head: dark skull, two horns, glowing sculk soul in the chest. */
export function WardenLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-label="Warden" role="img">
      <path d="M5 4 L10 11 L10 6 Z" fill="var(--primary)" opacity="0.85" />
      <path d="M27 4 L22 11 L22 6 Z" fill="var(--primary)" opacity="0.85" />
      <rect x="8" y="9" width="16" height="17" rx="3" fill="#0f3a42" stroke="var(--primary)" strokeOpacity="0.5" />
      <rect x="11" y="14" width="3" height="2" rx="0.5" fill="var(--bone)" opacity="0.6" />
      <rect x="18" y="14" width="3" height="2" rx="0.5" fill="var(--bone)" opacity="0.6" />
      <circle cx="16" cy="21" r="2.6" fill="var(--soul)" />
      <circle cx="16" cy="21" r="5" fill="var(--soul)" opacity="0.18" />
    </svg>
  );
}

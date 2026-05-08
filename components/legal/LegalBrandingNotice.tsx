import type { HTMLAttributes } from "react";

export default function LegalBrandingNotice({
  className = "",
  compact = false,
  ...props
}: HTMLAttributes<HTMLDivElement> & { compact?: boolean }) {
  return (
    <div
      className={`legal-branding-notice${compact ? " legal-branding-notice-compact" : ""} ${className}`.trim()}
      {...props}
    >
      <p>2026 SeraphCore. All rights reserved.</p>
      <p>Seraph Nexus and SeraphCore are trademarks of SeraphCore.</p>
    </div>
  );
}

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
} from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("admin-page-stack", className)}>{children}</div>;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("section-header", className)}>
      <div className="section-header-copy">
        {eyebrow ? <p className="section-kicker">{eyebrow}</p> : null}
        <h2 className="section-title">{title}</h2>
        {description ? <p className="section-description">{description}</p> : null}
      </div>
      {actions ? <div className="admin-actions">{actions}</div> : null}
    </div>
  );
}

export function ContentCard({
  children,
  className,
  as = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "article" | "div";
}) {
  const Component = as;
  return <Component className={cx("dashboard-secondary-panel", className)}>{children}</Component>;
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("empty-state app-empty-state", className)}>
      {title ? <p className="app-empty-state-title">{title}</p> : null}
      {description ? <div className="app-empty-state-description">{description}</div> : null}
      {action ? <div className="app-empty-state-action">{action}</div> : null}
    </div>
  );
}

export function LoadingState({
  label = "Loading",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cx("empty-state app-loading-state", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="loading-orb app-loading-state-indicator" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function AppNotice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "success" | "warning" | "error" | "info";
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("app-notice", `app-notice-${tone}`, className)} role={tone === "error" ? "alert" : "status"}>
      {title ? <p className="app-notice-title">{title}</p> : null}
      <div className="app-notice-body">{children}</div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  detail,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
  className?: string;
}) {
  return (
    <div className={cx("dashboard-metric-card", className)}>
      <p className="section-kicker">{label}</p>
      <p className={cx("app-stat-value", tone !== "default" && `app-stat-value-${tone}`)}>
        {value}
      </p>
      {detail ? <p className="app-stat-detail">{detail}</p> : null}
    </div>
  );
}

export function AppBadge({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
  className?: string;
}) {
  return <span className={cx("status-chip", `app-badge-${tone}`, className)}>{children}</span>;
}

export function SearchInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, type, ...rest } = props;
  return (
    <input
      type={type || "search"}
      className={cx("input-field app-search-input", className)}
      {...rest}
    />
  );
}

export function FormShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("form-section app-form-shell", className)}>{children}</div>;
}

export function FormSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cx("form-section app-form-section", className)}>{children}</section>;
}

export function FormField({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("app-form-field", className)}>{children}</div>;
}

export function FormLabel({
  children,
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cx("form-label app-form-label", className)} {...props}>
      {children}
    </label>
  );
}

export function FormHint({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("app-form-hint", className)}>{children}</p>;
}

export function FormError({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cx("app-form-error", className)} role="alert">
      {children}
    </p>
  );
}

export function FormActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("app-form-actions", className)}>{children}</div>;
}

export function ActionButton({
  children,
  tone = "secondary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary" | "danger";
}) {
  return (
    <button
      className={cx(
        tone === "primary" && "btn-primary",
        tone === "secondary" && "btn-secondary",
        tone === "danger" && "app-button-danger",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function DestructiveActionPanel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("app-destructive-panel", className)}>
      <div>
        <p className="app-destructive-title">{title}</p>
        {description ? <div className="app-destructive-description">{description}</div> : null}
      </div>
      {children ? <div className="app-destructive-actions">{children}</div> : null}
    </section>
  );
}

export function ConfirmActionPanel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("app-confirm-panel", className)}>
      <div>
        <p className="app-confirm-title">{title}</p>
        {description ? <div className="app-confirm-description">{description}</div> : null}
      </div>
      {children ? <div className="app-confirm-actions">{children}</div> : null}
    </section>
  );
}

import { Fragment, createContext, useContext, useMemo, useState, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type PropsWithChildren, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type NavItem = {
  label: string;
  href: string;
  active?: boolean;
  icon?: ReactNode;
  badge?: ReactNode;
};

type NavLinkRenderer = (input: {
  item: NavItem;
  className: string;
  children: ReactNode;
}) => ReactNode;

const buttonVariants = {
  primary: "bg-primary text-white shadow-panel hover:brightness-105",
  secondary: "border border-border bg-white/80 text-text-primary hover:bg-white",
  ghost: "text-text-secondary hover:bg-slate-900/5 hover:text-text-primary",
  danger: "bg-danger text-white hover:brightness-105",
} as const;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants;
};

export function Button({ className, variant = "primary", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60",
        buttonVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function IconButton({ className, children, ...props }: ButtonProps) {
  return (
    <Button variant="ghost" className={cn("h-11 w-11 rounded-full p-0", className)} {...props}>
      {children}
    </Button>
  );
}

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("glass-panel rounded-[28px] border border-border/70 p-5 shadow-panel", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function Badge({ className, children }: PropsWithChildren<{ className?: string }>) {
  return (
    <span className={cn("inline-flex items-center rounded-full border border-white/40 bg-slate-950 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white", className)}>
      {children}
    </span>
  );
}

export function Avatar({ name, src, className }: { name?: string | null; src?: string | null; className?: string }) {
  const initials = (name?.trim()?.slice(0, 2) || "LV").toUpperCase();
  return src ? (
    <img src={src} alt={name ?? "avatar"} className={cn("h-11 w-11 rounded-full object-cover", className)} />
  ) : (
    <div className={cn("flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white", className)}>
      {initials}
    </div>
  );
}

export function AppShell({
  topNav,
  sideNav,
  children,
  className,
}: PropsWithChildren<{ topNav?: ReactNode; sideNav?: ReactNode; className?: string }>) {
  return (
    <div className="min-h-screen">
      {topNav}
      <div className={cn("mx-auto flex w-full max-w-[1500px] gap-6 px-4 pb-10 pt-6 md:px-6", className)}>
        {sideNav ? <aside className="hidden w-72 shrink-0 lg:block">{sideNav}</aside> : null}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

export function TopNav({
  brand,
  items,
  rightContent,
  renderItem,
}: {
  brand: ReactNode;
  items?: NavItem[];
  rightContent?: ReactNode;
  renderItem?: NavLinkRenderer;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/50 bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 md:px-6">
        <div className="flex items-center gap-4">
          <div className="font-display text-lg font-semibold tracking-wide text-text-primary">{brand}</div>
          {items?.length ? (
            <nav className="hidden items-center gap-2 md:flex">
              {items.map((item) => (
                <Fragment key={item.href}>
                  {renderItem ? renderItem({
                    item,
                    className: cn(
                      "rounded-full px-4 py-2 text-sm font-medium transition",
                      item.active ? "bg-slate-950 text-white" : "text-text-secondary hover:bg-slate-900/5 hover:text-text-primary",
                    ),
                    children: item.label,
                  }) : (
                    <a
                      href={item.href}
                      className={cn(
                        "rounded-full px-4 py-2 text-sm font-medium transition",
                        item.active ? "bg-slate-950 text-white" : "text-text-secondary hover:bg-slate-900/5 hover:text-text-primary",
                      )}
                    >
                      {item.label}
                    </a>
                  )}
                </Fragment>
              ))}
            </nav>
          ) : null}
        </div>
        <div className="flex items-center gap-3">{rightContent}</div>
      </div>
    </header>
  );
}

export function SideNav({ title, items, footer, renderItem }: { title?: string; items: NavItem[]; footer?: ReactNode; renderItem?: NavLinkRenderer }) {
  return (
    <Card className="sticky top-24 p-3">
      {title ? <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.22em] text-text-secondary">{title}</p> : null}
      <nav className="space-y-1">
        {items.map((item) => (
          <Fragment key={item.href}>
            {renderItem ? renderItem({
              item,
              className: cn(
                "flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition",
                item.active ? "bg-slate-950 text-white shadow-glow" : "text-text-secondary hover:bg-slate-900/5 hover:text-text-primary",
              ),
              children: (
                <>
                  <span className="flex items-center gap-2">{item.icon}{item.label}</span>
                  {item.badge}
                </>
              ),
            }) : (
              <a
                href={item.href}
                className={cn(
                  "flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition",
                  item.active ? "bg-slate-950 text-white shadow-glow" : "text-text-secondary hover:bg-slate-900/5 hover:text-text-primary",
                )}
              >
                <span className="flex items-center gap-2">{item.icon}{item.label}</span>
                {item.badge}
              </a>
            )}
          </Fragment>
        ))}
      </nav>
      {footer ? <div className="mt-4 border-t border-border/70 px-3 pt-4">{footer}</div> : null}
    </Card>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">{eyebrow}</p> : null}
        <h1 className="font-display text-3xl font-semibold text-text-primary md:text-4xl">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm text-text-secondary md:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  meta,
  tone = "primary",
}: {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  tone?: "primary" | "success" | "warning";
}) {
  const accent = tone === "success" ? "bg-success/10 text-success" : tone === "warning" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary";

  return (
    <Card className="overflow-hidden">
      <div className={cn("mb-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]", accent)}>
        {label}
      </div>
      <div className="text-3xl font-semibold text-text-primary">{value}</div>
      {meta ? <div className="mt-2 text-sm text-text-secondary">{meta}</div> : null}
    </Card>
  );
}

export function Table({
  headers,
  rows,
  empty,
}: {
  headers: ReactNode[];
  rows: ReactNode[][];
  empty?: ReactNode;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-950 text-white">
            <tr>
              {headers.map((header, index) => (
                <th key={index} className="px-4 py-3 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t border-border/70">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-4 py-3 align-top text-text-secondary">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={headers.length} className="px-4 py-10">
                  {empty ?? <EmptyState title="No data yet" description="There is nothing to show in this table." />}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[24px] bg-slate-300/40", className)} />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-dashed border-border bg-white/60 px-6 py-10 text-center">
      <p className="font-display text-2xl font-semibold text-text-primary">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm text-text-secondary">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  retry,
}: {
  title?: string;
  description: string;
  retry?: () => void;
}) {
  return (
    <div className="rounded-[28px] border border-danger/25 bg-danger/5 px-6 py-10 text-center">
      <p className="font-display text-2xl font-semibold text-danger">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-sm text-text-secondary">{description}</p>
      {retry ? <Button className="mt-4" variant="danger" onClick={retry}>Retry</Button> : null}
    </div>
  );
}

export function Modal({
  open,
  title,
  description,
  children,
  footer,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4">
      <div className="w-full max-w-lg rounded-[28px] bg-white p-6 shadow-panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold text-text-primary">{title}</h2>
            {description ? <p className="mt-2 text-sm text-text-secondary">{description}</p> : null}
          </div>
          <IconButton aria-label="Close dialog" onClick={onClose}>x</IconButton>
        </div>
        {children ? <div className="mt-6">{children}</div> : null}
        {footer ? <div className="mt-6 flex justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  confirmTone = "primary",
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmTone?: "primary" | "danger";
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={confirmTone === "danger" ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}

export function Drawer({
  open,
  title,
  description,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 p-4 md:items-center">
      <div className="w-full max-w-2xl rounded-t-[30px] bg-white p-6 shadow-panel md:rounded-[30px]">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold text-text-primary">{title}</h2>
            {description ? <p className="mt-2 text-sm text-text-secondary">{description}</p> : null}
          </div>
          <IconButton aria-label="Close drawer" onClick={onClose}>x</IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: Array<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-border bg-white/70 p-1">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition",
            item.value === value ? "bg-slate-950 text-white" : "text-text-secondary hover:text-text-primary",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

const ToastContext = createContext<{ pushToast: (toast: { title: string; description?: string; tone?: "success" | "warning" | "danger" }) => void } | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<Array<{ id: string; title: string; description?: string; tone?: "success" | "warning" | "danger" }>>([]);

  const value = useMemo(
    () => ({
      pushToast: (toast: { title: string; description?: string; tone?: "success" | "warning" | "danger" }) => {
        const id = crypto.randomUUID();
        setItems((current) => [...current, { id, ...toast }]);
        window.setTimeout(() => {
          setItems((current) => current.filter((item) => item.id !== id));
        }, 3200);
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[120] flex w-full max-w-sm flex-col gap-3">
        {items.map((item) => {
          const toneClass =
            item.tone === "danger"
              ? "border-danger/20 bg-danger/10"
              : item.tone === "warning"
                ? "border-warning/20 bg-warning/10"
                : "border-success/20 bg-white";

          return (
            <div key={item.id} className={cn("rounded-[24px] border px-4 py-3 shadow-panel", toneClass)}>
              <p className="font-semibold text-text-primary">{item.title}</p>
              {item.description ? <p className="mt-1 text-sm text-text-secondary">{item.description}</p> : null}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider.");
  }

  return context;
}

export function FormField({
  label,
  hint,
  error,
  children,
}: PropsWithChildren<{ label: string; hint?: string; error?: string }>) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-text-primary">{label}</span>
      {children}
      {error ? <span className="text-sm text-danger">{error}</span> : hint ? <span className="text-sm text-text-secondary">{hint}</span> : null}
    </label>
  );
}

const fieldBaseClassName =
  "w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-text-primary outline-none transition placeholder:text-text-secondary/70 focus:border-primary focus:ring-2 focus:ring-primary/20";

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBaseClassName, className)} {...props} />;
}

export function PasswordInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="password" className={cn(fieldBaseClassName, className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldBaseClassName, className)} {...props}>
      {children}
    </select>
  );
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBaseClassName, "min-h-[120px] resize-y", className)} {...props} />;
}

export function CurrencyDisplay({
  value,
  currency = "IDR",
  compact = false,
}: {
  value: number;
  currency?: string;
  compact?: boolean;
}) {
  const formatted = new Intl.NumberFormat("id-ID", {
    style: currency === "COIN" || currency === "DIAMOND" ? "decimal" : "currency",
    currency: currency === "COIN" || currency === "DIAMOND" ? undefined : currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: 0,
  }).format(value);

  return (
    <span className="font-semibold text-text-primary">
      {currency === "COIN" || currency === "DIAMOND" ? `${formatted} ${currency}` : formatted}
    </span>
  );
}

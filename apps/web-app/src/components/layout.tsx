import {
  useEffect,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type FormEvent,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "../lib/cn.js";
import { useSession } from "../state/session.js";

type ShellNavItem = {
  label: string;
  href: string;
  icon: string;
  disabled?: boolean;
};

const primaryNavItems: ShellNavItem[] = [
  { label: "Home", href: "/", icon: "home" },
  { label: "Following", href: "/following", icon: "favorite" },
  { label: "Browse", href: "/browse", icon: "grid_view" },
  { label: "Esports", href: "/esports", icon: "sports_esports" },
  { label: "Clips", href: "/clips", icon: "movie" },
];

const personalNavItems: ShellNavItem[] = [
  { label: "My Feed", href: "/my-feed", icon: "dynamic_feed" },
  { label: "Messages", href: "/messages", icon: "mail" },
  { label: "Watch History", href: "/watch-history", icon: "history" },
  { label: "Saved", href: "/saved", icon: "bookmark" },
];

const utilityNavItems: ShellNavItem[] = [
  { label: "Settings", href: "/settings", icon: "settings" },
  { label: "Help", href: "/help", icon: "help_outline" },
];

function getHostNavItems(hasActiveHostTools: boolean) {
  return hasActiveHostTools
    ? [
        { label: "Go Live", href: "/go-live", icon: "sensors", cta: true },
        { label: "Stream Manager", href: "/stream-manager", icon: "tune" },
        { label: "Analytics", href: "/analytics", icon: "bar_chart" },
        { label: "Earnings", href: "/earnings", icon: "payments" },
      ]
    : [
        { label: "Go Live", href: "/go-live", icon: "sensors", cta: true },
      ];
}

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-background text-on-surface">
      <TopNavbar />
      <div className="mx-auto flex w-full max-w-[1600px] gap-6 px-4 pb-10 pt-6 md:px-6">
        <Sidebar />
        <main className="min-w-0 flex-1 rounded-[20px] border border-[rgb(64_72_93_/_0.16)] bg-[radial-gradient(circle_at_top_left,rgba(186,158,255,0.08),transparent_22%),linear-gradient(180deg,rgba(9,19,40,0.98),rgba(15,25,48,0.95))] p-5 shadow-[0_28px_90px_rgba(2,8,24,0.24)] md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

export function TopNavbar() {
  return (
    <header className="navbar-shell sticky top-0 z-50 border-b border-[rgb(126_211_255_/_0.14)] backdrop-blur-3xl">
      <div className="relative mx-auto grid h-[74px] max-w-[1600px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 md:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(400px,560px)_minmax(0,1fr)] lg:gap-4">
        <div className="flex min-w-0 items-center gap-3 md:gap-6">
          <MobileSidebarDrawer />
          <BrandLogo />
        </div>
        <div className="hidden w-full justify-self-center lg:block">
          <NavbarSearch />
        </div>
        <div className="ml-auto flex items-center gap-3 lg:ml-0 lg:justify-self-end">
          <NavbarActions />
        </div>
      </div>
      <div className="relative px-4 pb-4 lg:hidden">
        <NavbarSearch />
      </div>
    </header>
  );
}

export function BrandLogo() {
  return (
    <Link
      to="/"
      className="font-display text-2xl font-black uppercase tracking-[0.08em] text-transparent transition hover:brightness-110"
    >
      <span className="brand-logo-gradient">NEONPULSE</span>
    </Link>
  );
}

export function NavbarSearch() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate("/browse");
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <div className="glass-search group flex h-12 items-center rounded-full pl-12 pr-3 transition duration-300">
        <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[rgb(174_231_255)] transition duration-300 group-focus-within:text-white">
          search
        </span>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search streamers, games, or channels..."
          className="relative z-10 h-full w-full bg-transparent py-2 text-sm text-on-surface outline-none placeholder:text-[rgb(182_197_225)]"
        />
        <span className="relative z-10 hidden rounded-full border border-[rgb(126_211_255_/_0.16)] bg-[rgb(255_255_255_/_0.05)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[rgb(182_197_225)] sm:inline-flex">
          Enter
        </span>
      </div>
    </form>
  );
}

export function NavbarActions() {
  const navigate = useNavigate();
  const { user, isLoading } = useSession();

  if (isLoading) {
    return <div className="glass-pill h-10 w-28 rounded-full" />;
  }

  if (!user) {
    return <AuthActions />;
  }

  return (
    <>
      <IconAction label="Notifications" icon="notifications" />
      <IconAction label="Inbox" icon="mail" onClick={() => navigate("/messages")} />
      <ProfileMenu />
    </>
  );
}

export function AuthActions() {
  const location = useLocation();
  const isAuthPage = location.pathname === "/auth";
  const isRegisterMode = isAuthPage && new URLSearchParams(location.search).get("mode") === "register";

  return (
    <div className="flex items-center gap-3">
      <Link
        to="/auth"
        className={cn(
          "glass-pill inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition",
          isAuthPage && !isRegisterMode
            ? "border-[rgb(186_158_255_/_0.35)] text-primary"
            : "text-on-surface hover:border-[rgb(126_211_255_/_0.24)] hover:text-white",
        )}
      >
        Login
      </Link>
      <Link
        to="/auth?mode=register"
        className={cn(
          "inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold transition",
          isRegisterMode
            ? "border border-[rgb(186_158_255_/_0.35)] bg-surface-container-high text-primary"
            : "primary-button text-on-primary-fixed",
        )}
      >
        Daftar
      </Link>
    </div>
  );
}

export function ProfileMenu() {
  const navigate = useNavigate();
  const { user } = useSession();

  if (!user) {
    return null;
  }

  return (
    <details className="group relative">
      <summary className="glass-pill flex cursor-pointer list-none items-center gap-3 rounded-full px-2 py-1.5 transition hover:border-[rgb(126_211_255_/_0.24)] hover:text-white">
        <AvatarCircle name={user.name} avatarUrl={user.avatarUrl} />
        <div className="hidden text-left md:block">
          <p className="text-sm font-semibold text-on-surface">{user.name}</p>
          <p className="text-xs text-on-surface-variant">{user.handle}</p>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant">expand_more</span>
      </summary>
      <div className="glass-pill absolute right-0 top-[calc(100%+12px)] z-20 w-56 rounded-2xl p-2 shadow-[0_24px_80px_rgba(0,0,0,0.32)]">
        <ProfileMenuItem label="Profile" icon="person" onClick={() => navigate("/")} />
        <ProfileMenuItem label="Dashboard" icon="dashboard" onClick={() => navigate("/dashboard")} />
        <ProfileMenuItem label="Settings" icon="settings" onClick={() => navigate("/settings")} />
      </div>
    </details>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-[88px] hidden h-[calc(100vh-112px)] w-64 shrink-0 flex-col rounded-xl bg-surface-container-low p-3 md:flex">
      <ShellNavigation />
    </aside>
  );
}

function MobileSidebarDrawer() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open navigation menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="glass-pill inline-flex h-11 items-center gap-2 rounded-full px-3 text-on-surface md:hidden"
      >
        <span className="material-symbols-outlined text-[22px]">menu</span>
        <span className="text-sm font-semibold">Menu</span>
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
        <div className="fixed inset-0 z-[80] md:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[rgba(3,8,20,0.72)] backdrop-blur-sm"
          />
          <aside className="absolute left-0 top-0 flex h-full w-[min(88vw,340px)] flex-col border-r border-[rgb(126_211_255_/_0.16)] bg-surface-container-low p-3 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-[rgb(64_72_93_/_0.28)] px-2 pb-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-primary">Sidebar Menu</p>
                <p className="mt-1 text-sm text-on-surface-variant">Semua menu sidebar kiri tersedia di sini.</p>
              </div>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setOpen(false)}
                className="glass-pill inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="min-h-0 flex-1">
              <ShellNavigation onNavigate={() => setOpen(false)} />
            </div>
          </aside>
        </div>
          ,
          document.body,
        )
        : null}
    </>
  );
}

function ShellNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useSession();
  const hasActiveHostTools = Boolean(user && (user.role === "HOST" || user.role === "ADMIN"));
  const hostNavItems = getHostNavItems(hasActiveHostTools);

  return (
    <div className="stealth-scrollbar flex h-full min-h-0 flex-col gap-5 overflow-y-auto pr-1">
      <SidebarSection label="Main">
        {primaryNavItems.map((item) => (
          <SidebarNavItem key={item.href} item={item} onClick={onNavigate} />
        ))}
      </SidebarSection>

      {isAuthenticated ? (
        <>
          <SidebarSection label="Personal">
            {personalNavItems.map((item) => (
              <SidebarNavItem key={item.href} item={item} onClick={onNavigate} />
            ))}
          </SidebarSection>

          <SidebarSection
            label="Host Tools"
            hint={
              hasActiveHostTools ? undefined : "Start with Go Live. More creator tools unlock after you become an active host."
            }
          >
            {hostNavItems.map((item) => (
              <SidebarNavItem key={item.href} item={item} cta={item.cta} onClick={onNavigate} />
            ))}
          </SidebarSection>
        </>
      ) : null}

      <div className="mt-auto border-t border-[rgb(64_72_93_/_0.28)] pt-4">
        <SidebarSection label="Utility">
          {utilityNavItems.map((item) => (
            <SidebarNavItem key={item.href} item={item} onClick={onNavigate} />
          ))}
          {isAuthenticated ? (
            <SidebarActionItem
              label="Logout"
              icon="logout"
              onClick={() => {
                void logout().then(() => {
                  onNavigate?.();
                  navigate("/", { replace: true });
                });
              }}
            />
          ) : null}
        </SidebarSection>
      </div>
    </div>
  );
}

export function SidebarNavItem({ item, cta = false, onClick }: { item: ShellNavItem; cta?: boolean; onClick?: () => void }) {
  return (
    <NavLink
      to={item.href}
      end={item.href === "/"}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition",
          cta && !isActive && "border border-[rgb(186_158_255_/_0.18)] bg-[rgb(186_158_255_/_0.08)] text-primary",
          isActive
            ? "sidebar-active text-primary"
            : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className="material-symbols-outlined text-[20px]"
            style={isActive ? { fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" } : undefined}
          >
            {item.icon}
          </span>
          <span>{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

export function SidebarSection({
  label,
  hint,
  children,
}: PropsWithChildren<{ label: string; hint?: string }>) {
  return (
    <section>
      <div className="mb-2 px-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-on-surface-variant">{label}</p>
        {hint ? <p className="mt-1 text-[11px] leading-5 text-on-surface-variant">{hint}</p> : null}
      </div>
      <nav className="space-y-1">{children}</nav>
    </section>
  );
}

export function PageContainer({ children }: PropsWithChildren) {
  return <div className="space-y-8">{children}</div>;
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
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.28em] text-primary">{eyebrow}</p> : null}
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-on-surface">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-on-surface">{title}</h2>
        {description ? <p className="mt-1 text-sm text-on-surface-variant">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function ContentCard({ className, children }: PropsWithChildren<{ className?: string }>) {
  return (
    <section
      className={cn(
        "rounded-xl border border-[rgb(64_72_93_/_0.28)] bg-surface-container p-5 shadow-[0_20px_60px_rgba(2,8,24,0.28)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CategoryChip({
  active = false,
  children,
}: PropsWithChildren<{ active?: boolean }>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition",
        active
          ? "border-[rgb(186_158_255_/_0.32)] bg-surface-container-high text-primary"
          : "border-[rgb(64_72_93_/_0.25)] bg-surface-container text-on-surface-variant",
      )}
    >
      {children}
    </span>
  );
}

export function PrimaryButton({
  children,
  className,
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }>) {
  return (
    <button
      {...props}
      className={cn(
        "primary-button inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold text-on-primary-fixed transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className,
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center rounded-lg border border-[rgb(64_72_93_/_0.28)] bg-surface-container px-5 py-3 text-sm font-semibold text-on-surface transition hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function MaterialIcon({ name, filled = false, className }: { name: string; filled?: boolean; className?: string }) {
  return (
    <span
      className={cn("material-symbols-outlined", className)}
      style={filled ? { fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" } : undefined}
    >
      {name}
    </span>
  );
}

function IconAction({ label, icon, onClick }: { label: string; icon: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="glass-pill hidden h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition hover:border-[rgb(126_211_255_/_0.24)] hover:text-on-surface sm:inline-flex"
    >
      <span className="material-symbols-outlined text-[20px]">{icon}</span>
    </button>
  );
}

function ProfileMenuItem({ label, icon, onClick }: { label: string; icon: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
    >
      <span className="material-symbols-outlined text-[20px]">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function SidebarActionItem({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
    >
      <span className="material-symbols-outlined text-[20px]">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function AvatarCircle({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const fallback = useMemo(() => name.slice(0, 2).toUpperCase(), [name]);

  if (avatarUrl) {
    return (
      <img
        alt={name}
        src={avatarUrl}
        className="h-9 w-9 rounded-full border border-[rgb(186_158_255_/_0.3)] object-cover"
      />
    );
  }

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgb(186_158_255_/_0.3)] bg-surface-container-high text-xs font-bold text-on-surface">
      {fallback}
    </div>
  );
}
